'use strict';

//much of this should be rewritten. This should really just be getting whatever
  //sections the user is entitled to see and returning them.
  //Let Angular do the sorting, formatting etc. instead.

var seneca = require('seneca')();

seneca.listen(10104); //requests from Hapi REST

var userLevel = 0; //0 Public, //3 User, //6 Admin

var layout = {
  sectiontype: [],
  sectiontitle: [],
  sectionparents: [],
  sectionid: [],
  threadlist: [],
  role: []
};

//discovery
seneca.add({cmd:'config'}, function (msg, response) {
  msg.data.forEach(function (item) {
    if (item.name === 'Directory') {
      seneca.client({host:item.address, port:10101});
    }
  })
  response(null, msg.data);
});

seneca.add({role: "get",cmd: "section"}, function( msg, respond) {
  var requested = msg.id;

  //hardcoded rootlayout for now, should be in a config later
  var rootlayout = 'k4ps75';
  if (requested === 'none') {
    requested = rootlayout;
  }

  userLevel = 0;
  msg.userscope.forEach(function (item) {
    if (item === 'user') {
      userLevel = 3;
    }
    if (item === 'admin') {
      userLevel = 6;
    }
  });

  seneca.act({role:"find",cmd:"layout",id:rootlayout},function(err, result) {
    if (err) {
      //handleme
    }
    var sectionids = result.layout.sections.split(',');

    seneca.act({role:"list",cmd:"layout"},function(err, result) {
      if ( err ) {
        //handleme
      }

      var badOrder = [];
      result.listing.forEach(function (item) {
        badOrder.push(item.id);
      });

      var sortOrder = [];
      sectionids.forEach(function (id) {
        sortOrder.push(badOrder.indexOf(id));
      });

      var startpoint = Infinity;
      var endpoint = -1;
      var parentType = [];
      if (requested === rootlayout) {
        parentType = ['Root','SectionHead','Section','SubSection'];
        startpoint = 0;
        endpoint = sectionids.length-1; //-1 to skip the final 'divide'
      }

      var stopAt = [];
      var sectionCount = 0;

      sortOrder.forEach(function (item, z) {

        if (result.listing[item].id === requested) {
          parentType = [];
          startpoint = z;

          stopAt.push('Divide');
          parentType.push(result.listing[item].type);
          if (parentType[0] === 'SectionHead') {
            parentType.push('Section');
            parentType.push('SubSection');
            stopAt.push('SectionHead');
          } else if (parentType[0] === 'Section') {
            parentType.push('Subsection');
            stopAt.push('Section');
          } else if (parentType[0] === 'SubSection') {
            endpoint = z + 1;
          }
        }

        if (z > startpoint) {
          if (result.listing[item].type === stopAt[0] || result.listing[item].type === stopAt[1]) {
            if (endpoint === -1) {
              endpoint = z;
            }
          }
        }

        layout.sectiontype[sectionCount] = result.listing[item].type;
        layout.sectiontitle[sectionCount] = result.listing[item].title;
        layout.sectionparents[sectionCount] = result.listing[item].parent;
        layout.sectionid[sectionCount] = sectionids[z];
        layout.threadlist[sectionCount] = result.listing[item].threads;
        layout.role[sectionCount++] = result.listing[item].role;

      });
        var filtered = {
        sectiontype: [],
        sectiontitle: [],
        sectionparents: [],
        sectionid: [],
        threadlist: []
      };

      for (var z = startpoint; z < endpoint; z++) {
        var accessRequired = 6;
        if (layout.role[z] === 'Admin') {
          accessRequired = 6;
        } else if (layout.role[z] === 'User') {
          accessRequired = 3;
        } else if (layout.role[z] === 'Public') {
          accessRequired = 0;
        }

        if (userLevel >= accessRequired) {
          if (parentType[0] === 'Section') {
            if (layout.sectiontype[z] === 'Section') {
              filtered.sectiontype.push('SectionHead');
            } else if (layout.sectiontype[z] === 'SubSection') {
              filtered.sectiontype.push('Section');
            } else {
              filtered.sectiontype.push(layout.sectiontype[z]);
            }
          } else if (parentType[0] === 'SubSection') {
            if (layout.sectiontype[z] === 'SubSection') {
              filtered.sectiontype.push('SectionHead');
            }
          } else {
            filtered.sectiontype.push(layout.sectiontype[z]);
          }
          filtered.sectiontitle.push(layout.sectiontitle[z]);
          filtered.sectionparents.push(layout.sectionparents[z]);
          filtered.sectionid.push(layout.sectionid[z]);
          filtered.threadlist.push(layout.threadlist[z]);
        }
      }
      if (filtered.sectiontype[filtered.sectiontype.length-1] === 'Divide') {
        //remove last element if it's a 'Divide'
        filtered.sectiontype.pop();
        filtered.sectiontitle.pop();
        filtered.sectionparents.pop();
        filtered.sectionid.pop();
        filtered.threadlist.pop();
      }
      respond ( null, filtered);
    });
  });
});

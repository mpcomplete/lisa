var ItemTable = require("./itemTable.js");
var OutputFormat = require("./outputFormat.js");
var Settings = require("./settings.js");

var gTemplate;

function init() {
  gTemplate = document.querySelector("template");
  gTemplate.itemSetAdd = function(event, detail, sender) {
    var length = gTemplate.champion.itemSets.push(OutputFormat.newItemSet());
    gTemplate.$.itemSetTabs.selected = length - 1;
  };
  gTemplate.itemSetDelete = function(event, detail, sender) {
    var current = gTemplate.$.itemSetTabs.selected;
    gTemplate.champion.itemSets.splice(current, 1);
    if (current >= gTemplate.champion.itemSets.length)
      gTemplate.$.itemSetTabs.selected = current-1;
  };

  gTemplate.blockAdd = function(event, detail, sender) {
    var block = {type: "New Block", items: []};
    if (sender.tagName.toLowerCase() == "input") {
      block.type = sender.value;
      sender.value = "New Block";
    }
    getItemSet(sender).blocks.push(block);
  };
  gTemplate.blockDelete = function(event, detail, sender) {
    getItemSet(sender).blocks.splice(getBlockIndex(sender), 1);
  };

  // Watch for new <select> controls added by Polymer, so we can selectize them.
  var target = document.querySelector(".content");
  var observer = new window.MutationObserver(function(mutations) {
    var newSelect = false;
    mutations.forEach(function(m) {
      if (m.addedNodes.length > 0 &&
          (m.target.className.search("itemBlock-container") != -1 ||
           m.target.tagName.toLowerCase() == "core-pages")) {
        newSelect = true;
      }
    });
    if (newSelect)
      reselectize();
  });
  observer.observe(target, {childList: true, subtree: true});
}

function reselectize() {
  var selects = $("select.itemPicker:not(.selectized)");
  selects.selectize({
    plugins: ['drag_drop', 'remove_button'],
    maxItems: null,
    openOnFocus: Settings.itemPickerOpenOnFocus(),
    closeAfterSelect: true,
    valueField: 'id',
    labelField: 'name',
    searchField: 'name',
    options: ItemTable.getItemList(),
    render: {
      item: function(item, escape) {
        return "<div class='itemHandle' title=\"" + escape(item.name) + "\">"
            + "<img style='width:48px' src='"
            + ItemTable.idToImage(item.id) + "' />"
            + "<div class='itemNames'>" + escape(item.name) + "</div>"
            + "</div>";
      },
      option: function(item, escape) {
        return "<div>"
            + "<img style='width:30px' src='"
            + ItemTable.idToImage(item.id) + "' />"
            + escape(item.name)
            + "</div>";
      }
    },
  });

  selects.off("change");
  selects.on("change", function() {
    Settings.setItemPickerOpenOnFocus(false);
    var items = $(this).val() || [];
    getBlock(this).items = items.map(function(id) {
      return {count: 1, id: id};
    });
  });
}

function getItemSet(elem) {
  return gTemplate.champion.itemSets[$(elem).parents(".itemSet").index()-1];
}

function getBlock(elem) {
  return getItemSet(elem).blocks[getBlockIndex(elem)];
}

function getBlockIndex(elem) {
  return $(elem).parents(".itemBlock").index() - 1;
}

exports.init = init;

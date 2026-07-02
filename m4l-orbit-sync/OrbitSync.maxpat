{
	"patcher" : {
		"fileversion" : 1,
		"appversion" : {
			"major" : 8,
			"minor" : 6,
			"revision" : 0,
			"architecture" : "x64",
			"modernui" : 1
		},
		"classnamespace" : "box",
		"rect" : [ 100.0, 100.0, 640.0, 480.0 ],
		"gridsize" : [ 15.0, 15.0 ],
		"boxes" : [
			{
				"box" : {
					"id" : "obj-title",
					"maxclass" : "comment",
					"text" : "Orbit ↔ Ableton Sync",
					"fontsize" : 14.0,
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 20.0, 12.0, 220.0, 24.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-lbl-url",
					"maxclass" : "comment",
					"text" : "Orbit URL (LAN or Tailscale):",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 20.0, 48.0, 200.0, 20.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-url",
					"maxclass" : "textedit",
					"text" : "http://192.168.68.79:3001",
					"numinlets" : 1,
					"numoutlets" : 4,
					"outlettype" : [ "", "int", "", "" ],
					"parameter_enable" : 0,
					"patching_rect" : [ 220.0, 46.0, 300.0, 22.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-lbl-proj",
					"maxclass" : "comment",
					"text" : "Orbit project (blank = auto):",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 20.0, 80.0, 200.0, 20.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-proj",
					"maxclass" : "textedit",
					"text" : "",
					"numinlets" : 1,
					"numoutlets" : 4,
					"outlettype" : [ "", "int", "", "" ],
					"parameter_enable" : 0,
					"patching_rect" : [ 220.0, 78.0, 300.0, 22.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-prep-url",
					"maxclass" : "newobj",
					"text" : "prepend url",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 220.0, 112.0, 80.0, 22.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-prep-proj",
					"maxclass" : "newobj",
					"text" : "prepend project",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 340.0, 112.0, 100.0, 22.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-sync-btn",
					"maxclass" : "live.text",
					"text" : "Sync now",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"parameter_enable" : 1,
					"saved_attribute_attributes" : {
						"valueof" : {
							"parameter_longname" : "OrbitSyncNow",
							"parameter_shortname" : "Sync now",
							"parameter_type" : 2,
							"parameter_mmax" : 1
						}
					},
					"patching_rect" : [ 20.0, 150.0, 80.0, 24.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-msg-flush",
					"maxclass" : "message",
					"text" : "flushnow",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 120.0, 152.0, 62.0, 22.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-v8",
					"maxclass" : "newobj",
					"text" : "v8 orbit.v8.js",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "" ],
					"patching_rect" : [ 20.0, 210.0, 130.0, 22.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-node",
					"maxclass" : "newobj",
					"text" : "node.script orbit.node.js @autostart 1 @watch 1",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "bang" ],
					"patching_rect" : [ 20.0, 260.0, 300.0, 22.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-route-sent",
					"maxclass" : "newobj",
					"text" : "route sent status",
					"numinlets" : 1,
					"numoutlets" : 3,
					"outlettype" : [ "", "", "" ],
					"patching_rect" : [ 20.0, 300.0, 130.0, 22.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-status",
					"maxclass" : "message",
					"text" : "",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 170.0, 340.0, 350.0, 22.0 ]
				}
			},
			{
				"box" : {
					"id" : "obj-lbl-status",
					"maxclass" : "comment",
					"text" : "Status:",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 118.0, 342.0, 50.0, 20.0 ]
				}
			}
		],
		"lines" : [
			{ "patchline" : { "source" : [ "obj-url", 0 ], "destination" : [ "obj-prep-url", 0 ] } },
			{ "patchline" : { "source" : [ "obj-prep-url", 0 ], "destination" : [ "obj-node", 0 ] } },
			{ "patchline" : { "source" : [ "obj-proj", 0 ], "destination" : [ "obj-prep-proj", 0 ] } },
			{ "patchline" : { "source" : [ "obj-prep-proj", 0 ], "destination" : [ "obj-node", 0 ] } },
			{ "patchline" : { "source" : [ "obj-sync-btn", 0 ], "destination" : [ "obj-msg-flush", 0 ] } },
			{ "patchline" : { "source" : [ "obj-msg-flush", 0 ], "destination" : [ "obj-node", 0 ] } },
			{ "patchline" : { "source" : [ "obj-v8", 0 ], "destination" : [ "obj-node", 0 ] } },
			{ "patchline" : { "source" : [ "obj-v8", 1 ], "destination" : [ "obj-status", 0 ] } },
			{ "patchline" : { "source" : [ "obj-node", 0 ], "destination" : [ "obj-route-sent", 0 ] } },
			{ "patchline" : { "source" : [ "obj-route-sent", 0 ], "destination" : [ "obj-v8", 0 ] } },
			{ "patchline" : { "source" : [ "obj-route-sent", 1 ], "destination" : [ "obj-status", 0 ] } }
		]
	}
}

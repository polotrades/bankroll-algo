-- Server entry point. Max players (10) is set in Game Settings > Places.
local OfficeBuilder = require(script.Parent:WaitForChild("OfficeBuilder"))
local NPCGuide = require(script.Parent:WaitForChild("NPCGuide"))
local CallService = require(script.Parent:WaitForChild("CallService"))
local GameLoop = require(script.Parent:WaitForChild("GameLoop"))

local office = OfficeBuilder.build()
NPCGuide.init(office)
CallService.init(office)
GameLoop.run(office)

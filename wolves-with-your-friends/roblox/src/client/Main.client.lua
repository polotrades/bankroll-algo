-- Client entry point: builds the HUD, Shark OS and voice, then routes server events to them.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Net = require(Shared:WaitForChild("Net"))
local Deals = require(Shared:WaitForChild("Deals"))

local Client = script.Parent
local Hud = require(Client:WaitForChild("Hud"))
local Desktop = require(Client:WaitForChild("Desktop"))
local Voice = require(Client:WaitForChild("Voice"))
local Meeting = require(Client:WaitForChild("Meeting"))
local City = require(Client:WaitForChild("City"))
local Apps = Client:WaitForChild("apps")
local PhoneApp = require(Apps:WaitForChild("PhoneApp"))
local DealApp = require(Apps:WaitForChild("DealApp"))
local ScriptApp = require(Apps:WaitForChild("ScriptApp"))

Hud.init()
Desktop.init()
Voice.init()
Meeting.init()
City.init()

Desktop.registerApp({ id = "phone", name = "Phone", color = Color3.fromRGB(40, 170, 80), open = function()
	if PhoneApp.call then
		PhoneApp.open(PhoneApp.call)
	end
end })
for _, d in Deals.list do
	Desktop.registerApp({ id = d.id, name = d.app, color = d.color, open = function()
		DealApp.open(d.id)
	end })
end
Desktop.registerApp({ id = "script", name = "Script", color = Color3.fromRGB(40, 110, 230), open = ScriptApp.open })

Desktop.onLeave = function()
	if PhoneApp.call then
		Net.HangUp:FireServer()
	end
	Desktop.close()
end

Net.Status.OnClientEvent:Connect(function(s)
	Hud.setStatus(s)
	Desktop.setStatus(s)
end)
Net.Money.OnClientEvent:Connect(function(m)
	Hud.setPersonal(m.personal)
	Desktop.setPersonal(m.personal)
end)
Net.Toast.OnClientEvent:Connect(Hud.toast)

Net.CallOpen.OnClientEvent:Connect(function(call)
	Desktop.open()
	DealApp.resetAll()
	PhoneApp.open(call)
	DealApp.open("account")
end)
Net.CallUpdate.OnClientEvent:Connect(PhoneApp.update)
Net.CallClosed.OnClientEvent:Connect(function(info)
	PhoneApp.closed(info.reason == "taken" and ("taken over by " .. tostring(info.by)) or info.reason)
	if info.reason == "taken" or info.reason == "end of day" then
		Desktop.close()
	end
end)
Net.VerifyResult.OnClientEvent:Connect(DealApp.result)

Net.Meeting.OnClientEvent:Connect(function(m)
	Desktop.close()
	Meeting.show(m)
end)
Net.Report.OnClientEvent:Connect(Meeting.report)

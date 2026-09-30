-- Office NPCs turn toward ringing desks and shout directions; The Chairman makes speeches.
local NPCGuide = {}

local npcs

local RECEPTIONIST = {
	"Desk %d is ringing! MOVE IT!",
	"Ooh, Desk %d! I heard this one is loaded...",
	"Phone on Desk %d, sweetie! Chop chop!",
	"Desk %d! Don't tell anyone I told you.",
}
local GUARD = {
	"W-w-was that a phone?! Desk %d!",
	"AAH! Desk %d is ringing! I'm not scared!",
	"Desk %d... somebody get it before it gets ME!",
}

function NPCGuide.init(o)
	npcs = o.npcs
end

function NPCGuide.say(model: Model, text: string, seconds: number?)
	local head = model:FindFirstChild("Head")
	local bubble = head and head:FindFirstChild("Bubble") :: BillboardGui?
	if not bubble then
		return
	end
	local label = bubble:FindFirstChildWhichIsA("Frame"):FindFirstChild("Text") :: TextLabel
	label.Text = text
	bubble.Enabled = true
	local token = {}
	bubble:SetAttribute("Token", tostring(token))
	task.delay(seconds or 4, function()
		if bubble:GetAttribute("Token") == tostring(token) then
			bubble.Enabled = false
		end
	end)
end

local function face(model: Model, target: Vector3)
	local pivot = model:GetPivot()
	local flat = Vector3.new(target.X, pivot.Position.Y, target.Z)
	if (flat - pivot.Position).Magnitude > 0.1 then
		model:PivotTo(CFrame.lookAt(pivot.Position, flat))
	end
end

function NPCGuide.announce(desk)
	if not npcs then
		return
	end
	local pos = desk.monitor.Position
	face(npcs.receptionist, pos)
	NPCGuide.say(npcs.receptionist, string.format(RECEPTIONIST[math.random(#RECEPTIONIST)], desk.id))
	if math.random() < 0.5 then
		face(npcs.guard, pos)
		NPCGuide.say(npcs.guard, string.format(GUARD[math.random(#GUARD)], desk.id))
	end
end

function NPCGuide.chairman(text: string, seconds: number?)
	if npcs then
		NPCGuide.say(npcs.chairman, text, seconds or 6)
	end
end

return NPCGuide

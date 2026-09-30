-- Traffic 100 floors down. Cars live only on each player's machine, so they cost the server nothing.
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local City = {}

local COLORS = {
	Color3.fromRGB(230, 60, 50), Color3.fromRGB(250, 200, 40), Color3.fromRGB(240, 240, 240),
	Color3.fromRGB(40, 90, 200), Color3.fromRGB(30, 30, 35), Color3.fromRGB(255, 190, 0),
}

function City.init()
	local folder = Instance.new("Folder")
	folder.Name = "Traffic"
	folder.Parent = Workspace
	local rng = Random.new(3)
	local cars = {}
	for i = 1, 90 do
		local horizontal = rng:NextNumber() < 0.5
		local lane = rng:NextInteger(-8, 8) * 220 + (rng:NextNumber() < 0.5 and -5 or 5)
		local car = Instance.new("Part")
		car.Anchored = true
		car.CanCollide = false
		car.CastShadow = false
		car.Size = horizontal and Vector3.new(14, 5, 7) or Vector3.new(7, 5, 14)
		car.Color = COLORS[rng:NextInteger(1, #COLORS)]
		car.Material = Enum.Material.SmoothPlastic
		car.Parent = folder
		table.insert(cars, {
			part = car,
			horizontal = horizontal,
			lane = lane,
			speed = rng:NextNumber(40, 90) * (rng:NextNumber() < 0.5 and 1 or -1),
			offset = rng:NextNumber(0, 4000),
		})
		if i % 3 == 0 then
			local light = Instance.new("PointLight")
			light.Range = 20
			light.Brightness = 2
			light.Color = Color3.fromRGB(255, 240, 200)
			light.Parent = car
		end
	end
	local parts, cfs = {}, {}
	RunService.Heartbeat:Connect(function()
		local t = os.clock()
		table.clear(parts)
		table.clear(cfs)
		for _, c in cars do
			local d = ((t * c.speed + c.offset) % 4000) - 2000
			local pos = c.horizontal and Vector3.new(d, -697.5, c.lane) or Vector3.new(c.lane, -697.5, d)
			table.insert(parts, c.part)
			table.insert(cfs, CFrame.new(pos))
		end
		Workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged)
	end)
end

return City

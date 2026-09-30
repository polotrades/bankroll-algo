-- Builds a playable blockout of floor 100 in code: trading floor with ringing desk computers,
-- conference room, CEO office, break room, elevator lobby, floor-to-ceiling windows and a city far below.
-- Swap pieces for the real Blender models later; gameplay only relies on the names/tables returned here.
local ServerStorage = game:GetService("ServerStorage")
local Workspace = game:GetService("Workspace")

local OfficeBuilder = {}

local W, D, H = 180, 120, 16 -- floor width (x), depth (z), ceiling height

local function part(props): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if props.Shape then
		p.Shape = props.Shape -- shape first, so the size that follows sticks
	end
	for k, v in props do
		if k ~= "Parent" and k ~= "Shape" and k ~= "Size" and k ~= "CFrame" and k ~= "Position" then
			(p :: any)[k] = v
		end
	end
	if props.Size then
		p.Size = props.Size
	end
	if props.CFrame then
		p.CFrame = props.CFrame
	elseif props.Position then
		p.Position = props.Position
	end
	p.Parent = props.Parent
	return p
end

local function surfaceGui(p: BasePart, pixels: number?): SurfaceGui
	local g = Instance.new("SurfaceGui")
	g.Face = Enum.NormalId.Front
	g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	g.PixelsPerStud = pixels or 50
	g.LightInfluence = 0
	g.Parent = p
	return g
end

local function label(parent: Instance, text: string, props): TextLabel
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.Text = text
	l.TextColor3 = Color3.new(1, 1, 1)
	l.Size = UDim2.fromScale(1, 1)
	for k, v in props or {} do
		(l :: any)[k] = v
	end
	l.Parent = parent
	return l
end

-- A part whose front face (where SurfaceGuis draw) points along `facing`.
local function panel(parent: Instance, name: string, pos: Vector3, facing: Vector3, size: Vector3, color: Color3): Part
	return part({
		Name = name,
		Size = size,
		CFrame = CFrame.lookAt(pos, pos + facing),
		Color = color,
		Material = Enum.Material.SmoothPlastic,
		Parent = parent,
	})
end

local function buildShell(folder: Folder)
	part({ Name = "Floor", Size = Vector3.new(W, 1, D), Position = Vector3.new(0, -0.5, 0),
		Color = Color3.fromRGB(40, 44, 70), Material = Enum.Material.Fabric, Parent = folder })
	part({ Name = "Ceiling", Size = Vector3.new(W, 1, D), Position = Vector3.new(0, H + 0.5, 0),
		Color = Color3.fromRGB(215, 200, 180), Material = Enum.Material.SmoothPlastic, Parent = folder })
	for x = -80, 80, 20 do
		for z = -50, 50, 25 do
			local lamp = part({ Name = "CeilingLight", Size = Vector3.new(10, 0.3, 1.2), Position = Vector3.new(x, H - 0.1, z),
				Color = Color3.fromRGB(255, 236, 200), Material = Enum.Material.Neon, CanCollide = false, Parent = folder })
			local l = Instance.new("SurfaceLight")
			l.Face = Enum.NormalId.Bottom
			l.Brightness = 0.6
			l.Range = 18
			l.Color = Color3.fromRGB(255, 225, 185)
			l.Parent = lamp
		end
	end
	-- floor-to-ceiling windows with dark mullions
	local sides = {
		{ Vector3.new(0, H / 2, -D / 2), Vector3.new(W, H, 0.4), "x" },
		{ Vector3.new(0, H / 2, D / 2), Vector3.new(W, H, 0.4), "x" },
		{ Vector3.new(-W / 2, H / 2, 0), Vector3.new(0.4, H, D), "z" },
		{ Vector3.new(W / 2, H / 2, 0), Vector3.new(0.4, H, D), "z" },
	}
	for _, s in sides do
		part({ Name = "Window", Size = s[2], Position = s[1], Color = Color3.fromRGB(170, 210, 235),
			Transparency = 0.72, Material = Enum.Material.Glass, Parent = folder })
		local len = s[3] == "x" and W or D
		for t = -len / 2, len / 2, 12 do
			local pos = s[3] == "x" and Vector3.new(t, H / 2, s[1].Z) or Vector3.new(s[1].X, H / 2, t)
			part({ Name = "Mullion", Size = Vector3.new(0.8, H, 0.8), Position = pos,
				Color = Color3.fromRGB(35, 35, 40), Material = Enum.Material.Metal, Parent = folder })
		end
	end
	-- the rest of the tower, straight down to the street
	part({ Name = "TowerBody", Size = Vector3.new(W + 4, 690, D + 4), Position = Vector3.new(0, -346, 0),
		Color = Color3.fromRGB(90, 120, 150), Material = Enum.Material.Glass, Reflectance = 0.2, Parent = folder })
end

local function buildCity(folder: Folder)
	local rng = Random.new(100)
	part({ Name = "Street", Size = Vector3.new(4000, 2, 4000), Position = Vector3.new(0, -701, 0),
		Color = Color3.fromRGB(45, 45, 50), Material = Enum.Material.Asphalt, Parent = folder })
	for i = -8, 8 do
		for _, horizontal in { true, false } do
			local size = horizontal and Vector3.new(4000, 0.2, 24) or Vector3.new(24, 0.2, 4000)
			local pos = horizontal and Vector3.new(0, -699.9, i * 220) or Vector3.new(i * 220, -699.9, 0)
			part({ Name = "Road", Size = size, Position = pos, Color = Color3.fromRGB(25, 25, 28),
				Material = Enum.Material.Asphalt, CanCollide = false, Parent = folder })
		end
	end
	local palette = {
		Color3.fromRGB(70, 90, 120), Color3.fromRGB(150, 140, 125), Color3.fromRGB(60, 70, 80),
		Color3.fromRGB(180, 170, 150), Color3.fromRGB(95, 120, 140),
	}
	for _ = 1, 170 do
		local a = rng:NextNumber(0, math.pi * 2)
		local r = rng:NextNumber(170, 900)
		local x, z = math.cos(a) * r, math.sin(a) * r
		local w, d = rng:NextNumber(40, 110), rng:NextNumber(40, 110)
		local top = rng:NextNumber(-260, 60) - r * 0.08
		local h = top + 700
		local b = part({ Name = "Skyscraper", Size = Vector3.new(w, h, d), Position = Vector3.new(x, -700 + h / 2, z),
			Color = palette[rng:NextInteger(1, #palette)],
			Material = rng:NextNumber() < 0.5 and Enum.Material.Glass or Enum.Material.Concrete,
			Reflectance = 0.1, CastShadow = false, Parent = folder })
		if rng:NextNumber() < 0.35 then -- lit crown on top
			part({ Name = "Crown", Size = Vector3.new(w * 0.6, 3, d * 0.6), Position = b.Position + Vector3.new(0, h / 2 + 1.5, 0),
				Color = Color3.fromRGB(255, 200, 120), Material = Enum.Material.Neon, CastShadow = false, Parent = folder })
		end
	end
end

local function buildNPC(folder: Folder, name: string, cf: CFrame, colors): Model
	local m = Instance.new("Model")
	m.Name = name
	local root = part({ Name = "Root", Size = Vector3.new(2.6, 3, 1.6), CFrame = cf * CFrame.new(0, 3.6, 0),
		Color = colors.body, Material = Enum.Material.SmoothPlastic, Parent = m })
	part({ Name = "Legs", Size = Vector3.new(2, 2.1, 1.3), CFrame = cf * CFrame.new(0, 1.05, 0),
		Color = colors.legs, Material = Enum.Material.SmoothPlastic, Parent = m })
	local head = part({ Name = "Head", Shape = Enum.PartType.Ball, Size = Vector3.new(3.4, 3.4, 3.4),
		CFrame = cf * CFrame.new(0, 6.7, 0), Color = colors.skin, Material = Enum.Material.SmoothPlastic, Parent = m })
	for _, s in { -1, 1 } do
		part({ Name = "Eye", Shape = Enum.PartType.Ball, Size = Vector3.new(1, 1, 1),
			CFrame = cf * CFrame.new(0.55 * s, 7, -1.45), Color = Color3.new(1, 1, 1), Parent = m })
		part({ Name = "Pupil", Shape = Enum.PartType.Ball, Size = Vector3.new(0.4, 0.4, 0.4),
			CFrame = cf * CFrame.new(0.55 * s, 7, -1.9), Color = Color3.new(0, 0, 0), Parent = m })
	end
	if colors.hat then
		part({ Name = "Hat", Size = Vector3.new(3.2, 0.9, 3.2), CFrame = cf * CFrame.new(0, 8.3, 0),
			Color = colors.hat, Parent = m })
	end
	m.PrimaryPart = root
	-- Real Blender character imported in Studio? (ServerStorage/CharacterModels/<modelName>) Use it as the visuals.
	local library = ServerStorage:FindFirstChild("CharacterModels")
	local art = library and colors.modelName and library:FindFirstChild(colors.modelName)
	if art then
		local visual = art:Clone()
		if visual:IsA("BasePart") then
			local wrap = Instance.new("Model")
			visual.Parent = wrap
			visual = wrap
		end
		local _, size = visual:GetBoundingBox()
		visual:ScaleTo(visual:GetScale() * (colors.height or 8) / size.Y)
		local bbCf, bbSize = visual:GetBoundingBox()
		-- move the bounding box so it stands on the floor at cf; ART_YAW fixes models that import facing sideways
		local target = cf * CFrame.Angles(0, math.rad(colors.yaw or 0), 0) * CFrame.new(0, bbSize.Y / 2, 0)
		visual:PivotTo(target * bbCf:Inverse() * visual:GetPivot())
		for _, d in visual:GetDescendants() do
			if d:IsA("BasePart") then
				d.Anchored = true
				d.CanCollide = false
			end
		end
		visual.Name = "Art"
		visual.Parent = m
		for _, d in m:GetChildren() do
			if d:IsA("BasePart") then
				d.Transparency = 1
			end
		end
	end
	local bb = Instance.new("BillboardGui")
	bb.Name = "Bubble"
	bb.Size = UDim2.fromOffset(260, 70)
	bb.StudsOffsetWorldSpace = Vector3.new(0, 10.5, 0)
	bb.Adornee = head
	bb.MaxDistance = 120
	bb.Enabled = false
	bb.Parent = head
	local frame = Instance.new("Frame")
	frame.Size = UDim2.fromScale(1, 1)
	frame.BackgroundColor3 = Color3.new(1, 1, 1)
	frame.Parent = bb
	Instance.new("UICorner").Parent = frame
	label(frame, "", { Name = "Text", TextColor3 = Color3.fromRGB(20, 20, 30), Size = UDim2.new(1, -12, 1, -8),
		Position = UDim2.fromOffset(6, 4) })
	local nameTag = Instance.new("BillboardGui")
	nameTag.Size = UDim2.fromOffset(160, 24)
	nameTag.StudsOffsetWorldSpace = Vector3.new(0, 9, 0)
	nameTag.Adornee = head
	nameTag.MaxDistance = 60
	nameTag.Parent = head
	label(nameTag, name, { TextColor3 = Color3.fromRGB(255, 90, 90), TextStrokeTransparency = 0.5 })
	m.Parent = folder
	return m
end

local function buildDesk(folder: Folder, id: number, cf: CFrame)
	-- cf: standing where the player sits, looking at the monitor (-Z)
	local m = Instance.new("Model")
	m.Name = "Desk" .. id
	local wood = Color3.fromRGB(225, 215, 200)
	part({ Name = "Top", Size = Vector3.new(9, 0.6, 4.4), CFrame = cf * CFrame.new(0, 3, -2.2), Color = wood, Parent = m })
	for _, x in { -4.1, 4.1 } do
		part({ Name = "Leg", Size = Vector3.new(0.5, 3, 4), CFrame = cf * CFrame.new(x, 1.5, -2.2), Color = wood, Parent = m })
	end
	part({ Name = "Divider", Size = Vector3.new(9.6, 5, 0.4), CFrame = cf * CFrame.new(0, 3.8, -4.6),
		Color = Color3.fromRGB(45, 55, 105), Material = Enum.Material.Fabric, Parent = m })
	local monitor = part({ Name = "Monitor", Size = Vector3.new(4.6, 2.8, 0.3),
		CFrame = cf * CFrame.new(0, 5.5, -3.2) * CFrame.Angles(0, math.pi, 0),
		Color = Color3.fromRGB(25, 25, 30), Parent = m })
	part({ Name = "Stand", Size = Vector3.new(0.5, 1.4, 0.5), CFrame = cf * CFrame.new(0, 3.9, -3.3),
		Color = Color3.fromRGB(40, 40, 45), Parent = m })
	part({ Name = "Keyboard", Size = Vector3.new(3.2, 0.2, 1), CFrame = cf * CFrame.new(0, 3.4, -1.3),
		Color = Color3.fromRGB(200, 200, 205), Parent = m })
	part({ Name = "DeskPhone", Size = Vector3.new(1.2, 0.5, 1), CFrame = cf * CFrame.new(3.2, 3.55, -2),
		Color = Color3.fromRGB(60, 60, 65), Parent = m })
	local cam = part({ Name = "Webcam", Size = Vector3.new(0.8, 0.4, 0.4), CFrame = cf * CFrame.new(0, 7.1, -3.2),
		Color = Color3.fromRGB(20, 20, 20), Parent = m })
	part({ Name = "WebcamLight", Shape = Enum.PartType.Ball, Size = Vector3.new(0.18, 0.18, 0.18),
		CFrame = cam.CFrame * CFrame.new(0.25, 0, -0.2), Color = Color3.fromRGB(255, 40, 40),
		Material = Enum.Material.Neon, Parent = m })
	local lamp = part({ Name = "RingLamp", Shape = Enum.PartType.Ball, Size = Vector3.new(0.7, 0.7, 0.7),
		CFrame = cf * CFrame.new(2.7, 7.2, -3.2), Color = Color3.fromRGB(80, 80, 80), Material = Enum.Material.Neon, Parent = m })
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 50, 50)
	light.Range = 14
	light.Brightness = 3
	light.Enabled = false
	light.Parent = lamp
	-- chair is loose on purpose: people will throw it
	local seat = Instance.new("Seat")
	seat.Name = "Chair"
	seat.Size = Vector3.new(2.6, 0.8, 2.6)
	seat.CFrame = cf * CFrame.new(0, 2, 1)
	seat.Color = Color3.fromRGB(235, 235, 230)
	seat.Anchored = false
	seat.Parent = m
	for _ = 1, 3 do
		local note = part({ Name = "StickyNote", Size = Vector3.new(0.9, 0.9, 0.05),
			CFrame = cf * CFrame.new(math.random(-40, 40) / 10, 4.6 + math.random(0, 10) / 10, -4.38),
			Color = Color3.fromRGB(255, 225, 120), CanCollide = false, Parent = m })
		note.Orientation += Vector3.new(0, 0, math.random(-12, 12))
	end

	-- screen that everyone walking past can read
	local gui = surfaceGui(monitor, 60)
	gui.Name = "Mirror"
	local bg = Instance.new("Frame")
	bg.Size = UDim2.fromScale(1, 1)
	bg.BackgroundColor3 = Color3.fromRGB(20, 30, 60)
	bg.Parent = gui
	local grad = Instance.new("UIGradient")
	grad.Color = ColorSequence.new(Color3.fromRGB(40, 30, 90), Color3.fromRGB(230, 120, 60))
	grad.Rotation = 90
	grad.Parent = bg
	label(bg, "SHARK OS", { Name = "Title", Size = UDim2.fromScale(1, 0.22), TextColor3 = Color3.fromRGB(255, 215, 120) })
	label(bg, "", { Name = "Caller", Size = UDim2.fromScale(1, 0.2), Position = UDim2.fromScale(0, 0.24) })
	local barBack = Instance.new("Frame")
	barBack.Name = "TrustBack"
	barBack.Size = UDim2.fromScale(0.8, 0.1)
	barBack.Position = UDim2.fromScale(0.1, 0.48)
	barBack.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
	barBack.Visible = false
	barBack.Parent = bg
	local bar = Instance.new("Frame")
	bar.Name = "Trust"
	bar.Size = UDim2.fromScale(0.25, 1)
	bar.BackgroundColor3 = Color3.fromRGB(90, 220, 110)
	bar.BorderSizePixel = 0
	bar.Parent = barBack
	label(bg, "", { Name = "Line", Size = UDim2.fromScale(0.92, 0.3), Position = UDim2.fromScale(0.04, 0.64),
		Font = Enum.Font.Gotham })

	local ring = Instance.new("BillboardGui")
	ring.Name = "RingTag"
	ring.AlwaysOnTop = true
	ring.Size = UDim2.fromOffset(170, 46)
	ring.StudsOffsetWorldSpace = Vector3.new(0, 5, 0)
	ring.Enabled = false
	ring.Parent = monitor
	local rf = Instance.new("Frame")
	rf.Size = UDim2.fromScale(1, 1)
	rf.BackgroundColor3 = Color3.fromRGB(230, 40, 50)
	rf.Parent = ring
	Instance.new("UICorner").Parent = rf
	label(rf, "RING RING! Desk " .. id, { Size = UDim2.new(1, -10, 1, -6), Position = UDim2.fromOffset(5, 3) })

	local answer = Instance.new("ProximityPrompt")
	answer.Name = "Answer"
	answer.ActionText = "Answer"
	answer.ObjectText = "Desk " .. id
	answer.KeyboardKeyCode = Enum.KeyCode.E
	answer.MaxActivationDistance = 11
	answer.RequiresLineOfSight = false
	answer.Enabled = false
	answer.Parent = monitor
	local takeover = Instance.new("ProximityPrompt")
	takeover.Name = "TakeOver"
	takeover.ActionText = "Take Over Call"
	takeover.ObjectText = "Desk " .. id
	takeover.KeyboardKeyCode = Enum.KeyCode.F
	takeover.HoldDuration = 0.4
	takeover.MaxActivationDistance = 11
	takeover.RequiresLineOfSight = false
	takeover.Enabled = false
	takeover.UIOffset = Vector2.new(0, 70)
	takeover.Parent = monitor

	m.Parent = folder
	return {
		id = id,
		model = m,
		monitor = monitor,
		lamp = lamp,
		light = light,
		ringTag = ring,
		answer = answer,
		takeover = takeover,
		mirror = bg,
		seatCFrame = cf * CFrame.new(0, 3, 1),
		state = "idle",
	}
end

local function buildConference(folder: Folder)
	local wall = Color3.fromRGB(60, 50, 60)
	-- x 55..88, z -58..-22 ; glass front at z = -22 with a door gap
	part({ Name = "ConfWallWest", Size = Vector3.new(1, H, 36), Position = Vector3.new(55, H / 2, -40), Color = wall, Parent = folder })
	part({ Name = "ConfGlassA", Size = Vector3.new(22, H, 0.4), Position = Vector3.new(66, H / 2, -22),
		Transparency = 0.6, Material = Enum.Material.Glass, Color = Color3.fromRGB(180, 210, 230), Parent = folder })
	part({ Name = "ConfGlassB", Size = Vector3.new(4, H, 0.4), Position = Vector3.new(88, H / 2, -22),
		Transparency = 0.6, Material = Enum.Material.Glass, Color = Color3.fromRGB(180, 210, 230), Parent = folder })
	part({ Name = "ConfTable", Size = Vector3.new(10, 1, 24), Position = Vector3.new(70, 3.2, -40),
		Color = Color3.fromRGB(120, 25, 30), Material = Enum.Material.Wood, Parent = folder })
	part({ Name = "ConfTableBase", Size = Vector3.new(3, 3, 16), Position = Vector3.new(70, 1.5, -40),
		Color = Color3.fromRGB(30, 20, 20), Parent = folder })
	local seats = {}
	for i = 0, 4 do
		for _, s in { -1, 1 } do
			local pos = Vector3.new(70 + s * 8, 0, -50 + i * 5)
			local cf = CFrame.lookAt(pos, Vector3.new(88, 0, -40))
			table.insert(seats, cf * CFrame.new(0, 3, 0))
			local chair = Instance.new("Seat")
			chair.Size = Vector3.new(2.6, 0.8, 2.6)
			chair.CFrame = cf * CFrame.new(0, 2, 0)
			chair.Color = Color3.fromRGB(30, 30, 35)
			chair.Anchored = false
			chair.Parent = folder
		end
	end
	local screen = panel(folder, "MeetingScreen", Vector3.new(87.2, 8, -40), Vector3.new(-1, 0, 0),
		Vector3.new(22, 11, 0.4), Color3.fromRGB(15, 15, 20))
	local gui = surfaceGui(screen, 40)
	local bg = Instance.new("Frame")
	bg.Name = "Board"
	bg.Size = UDim2.fromScale(1, 1)
	bg.BackgroundColor3 = Color3.fromRGB(245, 205, 60)
	bg.Parent = gui
	label(bg, "CALL ANALYSIS", { Name = "Title", Size = UDim2.fromScale(1, 0.18), TextColor3 = Color3.fromRGB(40, 20, 10) })
	label(bg, "", { Name = "Body", Size = UDim2.fromScale(0.92, 0.74), Position = UDim2.fromScale(0.04, 0.22),
		TextColor3 = Color3.fromRGB(40, 20, 10), Font = Enum.Font.GothamBold, TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true })
	return { screen = screen, board = bg, seats = seats, fireSpots = { Vector3.new(70, 4, -46), Vector3.new(70, 4, -34),
		Vector3.new(62, 0.5, -52), Vector3.new(78, 0.5, -28), Vector3.new(62, 0.5, -30) } }
end

local function buildRooms(folder: Folder)
	-- CEO office: glass box, gold desk
	for _, spec in {
		{ Vector3.new(66, H / 2, 22), Vector3.new(22, H, 0.4) },
		{ Vector3.new(55, H / 2, 40), Vector3.new(0.4, H, 36) },
	} do
		part({ Name = "CEOGlass", Size = spec[2], Position = spec[1], Transparency = 0.6, Material = Enum.Material.Glass,
			Color = Color3.fromRGB(200, 190, 150), Parent = folder })
	end
	part({ Name = "GoldDesk", Size = Vector3.new(12, 3.4, 5), Position = Vector3.new(74, 1.7, 44),
		Color = Color3.fromRGB(230, 180, 50), Material = Enum.Material.Metal, Reflectance = 0.3, Parent = folder })
	part({ Name = "CEORug", Size = Vector3.new(26, 0.1, 30), Position = Vector3.new(72, 0.05, 40),
		Color = Color3.fromRGB(120, 20, 30), Material = Enum.Material.Fabric, Parent = folder })
	-- break room: counter, fridge, water cooler, whiteboard, plants (loose)
	part({ Name = "Counter", Size = Vector3.new(4, 3.4, 16), Position = Vector3.new(86, 1.7, 0),
		Color = Color3.fromRGB(200, 170, 130), Parent = folder })
	part({ Name = "Fridge", Size = Vector3.new(4, 9, 4), Position = Vector3.new(86, 4.5, 11),
		Color = Color3.fromRGB(235, 235, 235), Material = Enum.Material.Metal, Parent = folder })
	part({ Name = "Microwave", Size = Vector3.new(2.6, 1.6, 2), Position = Vector3.new(86, 4.2, -3),
		Color = Color3.fromRGB(230, 230, 230), Anchored = false, Parent = folder })
	part({ Name = "WaterCooler", Size = Vector3.new(2, 5, 2), Position = Vector3.new(80, 2.5, -14),
		Color = Color3.fromRGB(150, 200, 255), Anchored = false, Parent = folder })
	local board = panel(folder, "Whiteboard", Vector3.new(87.6, 8, 0), Vector3.new(-1, 0, 0), Vector3.new(12, 6, 0.3),
		Color3.fromRGB(245, 245, 245))
	local g = surfaceGui(board, 40)
	label(g, "DAILY TARGETS\n1. DIAL\n2. CLOSE\n3. DIAL AGAIN\n4. YACHT :)", {
		TextColor3 = Color3.fromRGB(20, 40, 120), Font = Enum.Font.PermanentMarker })
	for _, pos in { Vector3.new(60, 2, -16), Vector3.new(60, 2, 16), Vector3.new(-30, 2, -52), Vector3.new(-30, 2, 52) } do
		local pot = part({ Name = "Plant", Size = Vector3.new(2.2, 3, 2.2), Position = pos, Color = Color3.fromRGB(150, 100, 70),
			Anchored = false, Parent = folder })
		local leaves = part({ Name = "Leaves", Shape = Enum.PartType.Ball, Size = Vector3.new(4, 4, 4),
			Position = pos + Vector3.new(0, 3.2, 0), Color = Color3.fromRGB(80, 170, 70), Anchored = false, Parent = folder })
		local weld = Instance.new("WeldConstraint")
		weld.Part0, weld.Part1 = pot, leaves
		weld.Parent = pot
	end
	-- elevator lobby with the giant LED logo
	for _, z in { -12, 0, 12 } do
		part({ Name = "ElevatorDoor", Size = Vector3.new(0.6, 11, 7), Position = Vector3.new(-89.4, 5.5, z),
			Color = Color3.fromRGB(190, 170, 110), Material = Enum.Material.Metal, Reflectance = 0.3, Parent = folder })
	end
	local logo = panel(folder, "LEDLogo", Vector3.new(-89, 13.5, 0), Vector3.new(1, 0, 0), Vector3.new(40, 4, 0.3),
		Color3.fromRGB(10, 10, 15))
	local lg = surfaceGui(logo, 30)
	label(lg, "WOLVES WITH YOUR FRIENDS", { TextColor3 = Color3.fromRGB(255, 200, 80) })
	part({ Name = "ReceptionDesk", Size = Vector3.new(4, 4, 16), Position = Vector3.new(-66, 2, 0),
		Color = Color3.fromRGB(240, 235, 225), Parent = folder })
end

function OfficeBuilder.build()
	local folder = Instance.new("Folder")
	folder.Name = "Floor100"
	folder.Parent = Workspace
	local city = Instance.new("Folder")
	city.Name = "City"
	city.Parent = Workspace

	buildShell(folder)
	buildCity(city)
	buildRooms(folder)

	local desks = {}
	local id = 1
	for row = 0, 1 do
		for i = 0, 6 do
			local x = -52 + i * 14
			local z = row == 0 and -14 or 14
			local facing = row == 0 and Vector3.new(0, 0, -1) or Vector3.new(0, 0, 1)
			local pos = Vector3.new(x, 0, z)
			table.insert(desks, buildDesk(folder, id, CFrame.lookAt(pos, pos + facing)))
			id += 1
		end
	end

	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "ElevatorSpawn"
	spawn.Size = Vector3.new(10, 1, 20)
	spawn.Position = Vector3.new(-80, 0.1, 0)
	spawn.Anchored = true
	spawn.Transparency = 1
	spawn.CanCollide = false
	spawn.Neutral = true
	spawn.Parent = folder

	local npcs = {
		receptionist = buildNPC(folder, "Receptionist", CFrame.lookAt(Vector3.new(-62, 0, 0), Vector3.new(0, 0, 0)), {
			body = Color3.fromRGB(30, 140, 140), legs = Color3.fromRGB(100, 30, 80), skin = Color3.fromRGB(185, 115, 80),
			modelName = "Receptionist", height = 7.5 }),
		guard = buildNPC(folder, "Security Guard", CFrame.lookAt(Vector3.new(48, 0, -26), Vector3.new(0, 0, 0)), {
			body = Color3.fromRGB(30, 40, 80), legs = Color3.fromRGB(25, 30, 60), skin = Color3.fromRGB(150, 95, 65),
			hat = Color3.fromRGB(30, 40, 80), modelName = "SecurityGuard", height = 8.5 }),
		chairman = buildNPC(folder, "The Chairman", CFrame.lookAt(Vector3.new(74, 0, 49), Vector3.new(74, 0, 0)), {
			body = Color3.fromRGB(240, 180, 50), legs = Color3.fromRGB(220, 160, 40), skin = Color3.fromRGB(235, 150, 95),
			modelName = "TheChairman", height = 9 }),
	}

	return {
		folder = folder,
		desks = desks,
		conference = buildConference(folder),
		npcs = npcs,
		lobby = CFrame.new(-78, 3, 0),
	}
end

return OfficeBuilder

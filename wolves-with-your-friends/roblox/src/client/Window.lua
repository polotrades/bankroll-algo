-- Draggable Shark OS windows with minimize / maximize / close, like the reference game's desktop.
local UserInputService = game:GetService("UserInputService")
local UI = require(script.Parent:WaitForChild("UI"))

local Window = {}
Window.__index = Window

local topZ = 10

function Window.new(host: GuiObject, title: string, iconColor: Color3, size: UDim2, pos: UDim2)
	local self = setmetatable({}, Window)
	topZ += 1
	local frame = UI.new("Frame", {
		Name = title,
		Size = size,
		Position = pos,
		BackgroundColor3 = UI.colors.panel,
		BorderSizePixel = 0,
		ZIndex = topZ,
		Parent = host,
	})
	UI.new("UIStroke", { Color = Color3.fromRGB(10, 10, 16), Thickness = 2, Parent = frame })
	local bar = UI.new("Frame", {
		Name = "TitleBar",
		Size = UDim2.new(1, 0, 0, 34),
		BackgroundColor3 = UI.colors.titlebar,
		BorderSizePixel = 0,
		Parent = frame,
	})
	UI.new("Frame", { Size = UDim2.fromOffset(20, 20), Position = UDim2.fromOffset(8, 7), BackgroundColor3 = iconColor,
		Parent = bar }, { UI.new("UICorner", { CornerRadius = UDim.new(0, 5) }) })
	UI.text(bar, title, { Size = UDim2.new(1, -150, 1, -10), Position = UDim2.fromOffset(36, 5),
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = UI.colors.dark, Font = UI.bold })
	local content = UI.new("Frame", {
		Name = "Content",
		Size = UDim2.new(1, 0, 1, -34),
		Position = UDim2.fromOffset(0, 34),
		BackgroundTransparency = 1,
		ClipsDescendants = true,
		Parent = frame,
	})
	self.frame, self.content, self.bar = frame, content, bar
	self.normalSize, self.normalPos = size, pos
	self.onClose = nil

	local function barButton(x: number, text: string, color: Color3, fn)
		local b = UI.new("TextButton", {
			Size = UDim2.fromOffset(34, 28), Position = UDim2.new(1, x, 0, 3), BackgroundTransparency = 1,
			Font = UI.bold, TextSize = 22, TextColor3 = color, Text = text, Parent = bar,
		})
		b.Activated:Connect(fn)
	end
	barButton(-40, "X", UI.colors.red, function()
		self:close()
	end)
	barButton(-78, "[ ]", UI.colors.dark, function()
		self:toggleMax()
	end)
	barButton(-116, "_", UI.colors.dark, function()
		self:setMinimized(true)
	end)

	-- drag by the title bar, bring to front on click
	local dragging, dragStart, startPos
	bar.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging, dragStart, startPos = true, input.Position, frame.Position
			self:focus()
		end
	end)
	frame.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			self:focus()
		end
	end)
	self.conns = {}
	table.insert(self.conns, UserInputService.InputChanged:Connect(function(input)
		if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
			local delta = input.Position - dragStart
			frame.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + delta.X, startPos.Y.Scale, startPos.Y.Offset + delta.Y)
		end
	end))
	table.insert(self.conns, UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = false
		end
	end))
	return self
end

function Window:focus()
	topZ += 1
	self.frame.ZIndex = topZ
end

function Window:setMinimized(on: boolean)
	self.frame.Visible = not on
	if not on then
		self:focus()
	end
end

function Window:toggleMax()
	self.maxed = not self.maxed
	if self.maxed then
		self.frame.Size = UDim2.new(1, 0, 1, -56)
		self.frame.Position = UDim2.fromOffset(0, 0)
	else
		self.frame.Size, self.frame.Position = self.normalSize, self.normalPos
	end
end

function Window:close()
	if self.onClose then
		self.onClose()
	end
	for _, conn in self.conns do
		conn:Disconnect()
	end
	self.frame:Destroy()
	self.closed = true
end

return Window

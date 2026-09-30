-- Tiny UI toolkit shared by every screen.
local UI = {}

UI.colors = {
	bg = Color3.fromRGB(18, 20, 32),
	panel = Color3.fromRGB(28, 31, 48),
	panel2 = Color3.fromRGB(38, 42, 64),
	titlebar = Color3.fromRGB(245, 245, 248),
	text = Color3.fromRGB(245, 245, 250),
	dark = Color3.fromRGB(25, 25, 35),
	dim = Color3.fromRGB(150, 155, 175),
	gold = Color3.fromRGB(255, 196, 64),
	green = Color3.fromRGB(80, 220, 110),
	yellow = Color3.fromRGB(255, 205, 50),
	red = Color3.fromRGB(230, 50, 60),
	blue = Color3.fromRGB(60, 120, 230),
	orange = Color3.fromRGB(255, 140, 50),
}

UI.font = Enum.Font.FredokaOne
UI.body = Enum.Font.GothamMedium
UI.bold = Enum.Font.GothamBold

function UI.new(class: string, props, children)
	local inst = Instance.new(class)
	local parent
	for k, v in props or {} do
		if k == "Parent" then
			parent = v
		else
			(inst :: any)[k] = v
		end
	end
	for _, c in children or {} do
		c.Parent = inst
	end
	inst.Parent = parent
	return inst
end

function UI.corner(parent: Instance, radius: number?)
	return UI.new("UICorner", { CornerRadius = UDim.new(0, radius or 8), Parent = parent })
end

function UI.pad(parent: Instance, px: number)
	return UI.new("UIPadding", {
		PaddingLeft = UDim.new(0, px), PaddingRight = UDim.new(0, px),
		PaddingTop = UDim.new(0, px), PaddingBottom = UDim.new(0, px), Parent = parent,
	})
end

function UI.text(parent: Instance, text: string, props): TextLabel
	local l = UI.new("TextLabel", {
		BackgroundTransparency = 1,
		Font = UI.font,
		TextScaled = true,
		TextColor3 = UI.colors.text,
		Text = text,
		Size = UDim2.fromScale(1, 1),
		Parent = parent,
	})
	for k, v in props or {} do
		(l :: any)[k] = v
	end
	return l
end

function UI.button(parent: Instance, text: string, color: Color3, props, onClick: (() -> ())?): TextButton
	local b = UI.new("TextButton", {
		BackgroundColor3 = color,
		AutoButtonColor = true,
		Font = UI.font,
		TextScaled = true,
		TextColor3 = Color3.new(1, 1, 1),
		Text = text,
		Parent = parent,
	})
	for k, v in props or {} do
		(b :: any)[k] = v
	end
	UI.corner(b, 8)
	UI.new("UITextSizeConstraint", { MaxTextSize = 26, Parent = b })
	if onClick then
		b.Activated:Connect(onClick)
	end
	return b
end

function UI.money(n: number): string
	local s = tostring(math.floor(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	if out:sub(1, 1) == "," then
		out = out:sub(2)
	end
	return "$" .. out
end

function UI.clock(seconds: number): string
	seconds = math.max(0, math.floor(seconds))
	return string.format("%d:%02d", seconds // 60, seconds % 60)
end

return UI

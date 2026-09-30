-- Talking out loud: mic -> AudioSpeechToText -> transcript, and AI replies -> AudioTextToSpeech -> headset.
-- Needs: Game Settings > Communication > Enable Microphone, and VoiceChatService.UseAudioApi = Enabled.
-- If any of that is missing, voice quietly turns off and players type instead.
local Players = game:GetService("Players")
local SoundService = game:GetService("SoundService")

local Voice = {
	speakerOn = true,
	micOn = false,
	micAvailable = false,
	onTranscript = nil :: ((string) -> ())?,
}

local tts: AudioTextToSpeech?
local stt: AudioSpeechToText?
local mic: AudioDeviceInput?
local speakToken = 0

local function wire(src: Instance, dst: Instance)
	local w = Instance.new("Wire")
	w.SourceInstance = src
	w.TargetInstance = dst
	w.Parent = dst
end

function Voice.init()
	local ok, err = pcall(function()
		local folder = Instance.new("Folder")
		folder.Name = "HeadsetAudio"
		folder.Parent = SoundService
		local speech = Instance.new("AudioTextToSpeech")
		speech.Volume = 1.4
		speech.Parent = folder
		local out = Instance.new("AudioDeviceOutput")
		out.Parent = folder
		wire(speech, out)
		tts = speech
	end)
	if not ok then
		warn("[Voice] text-to-speech unavailable:", err)
		tts = nil
	end
	local okMic, errMic = pcall(function()
		local input = Instance.new("AudioDeviceInput")
		input.Player = Players.LocalPlayer
		input.Parent = Players.LocalPlayer
		local transcriber = Instance.new("AudioSpeechToText")
		transcriber.Enabled = false
		transcriber.Parent = Players.LocalPlayer
		wire(input, transcriber)
		transcriber:GetPropertyChangedSignal("Text"):Connect(function()
			local text = transcriber.Text
			if text == "" then
				return
			end
			local cb = Voice.onTranscript
			if Voice.micOn and cb then
				cb(text)
			end
			transcriber.Text = ""
		end)
		mic, stt = input, transcriber
	end)
	Voice.micAvailable = okMic
	if not okMic then
		warn("[Voice] speech-to-text unavailable, typing only:", errMic)
	end
end

function Voice.setMic(on: boolean)
	Voice.micOn = on and Voice.micAvailable
	if stt then
		stt.Enabled = Voice.micOn
	end
	return Voice.micOn
end

function Voice.speak(text: string, voiceId: string, pitch: number?, speed: number?)
	if not (tts and Voice.speakerOn) then
		return
	end
	speakToken += 1
	local mine = speakToken
	local t = tts :: AudioTextToSpeech
	t:Pause()
	t.TimePosition = 0
	t.Text = text:sub(1, 290)
	t.VoiceId = voiceId
	t.Pitch = pitch or 1
	t.Speed = speed or 1
	task.spawn(function()
		local status = t:LoadAsync()
		if mine == speakToken and status == Enum.AssetFetchStatus.Success then
			t:Play()
		end
	end)
end

function Voice.stop()
	speakToken += 1
	if tts then
		tts:Pause()
	end
end

function Voice.isSpeaking(): boolean
	return tts ~= nil and (tts :: AudioTextToSpeech).IsPlaying
end

return Voice

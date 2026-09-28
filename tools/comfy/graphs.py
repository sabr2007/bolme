"""ComfyUI API-format graphs for Wan 2.2 image-to-video and first-last-frame (14B, 4-step lightx2v LoRA)."""

WAN_HIGH = "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors"
WAN_LOW = "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors"
WAN_LORA_HIGH = "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors"
WAN_LORA_LOW = "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors"
WAN_TEXT_ENCODER = "umt5_xxl_fp8_e4m3fn_scaled.safetensors"
WAN_VAE = "wan_2.1_vae.safetensors"

WAN_STEPS = 4
WAN_SPLIT_STEP = 2
WAN_SHIFT = 5.0
WAN_FPS = 16
WAN_NEGATIVE = (
    "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，"
    "JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，"
    "手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走"
)


def _wan_models() -> dict:
    return {
        "unet_high": {"class_type": "UNETLoader", "inputs": {"unet_name": WAN_HIGH, "weight_dtype": "default"}},
        "unet_low": {"class_type": "UNETLoader", "inputs": {"unet_name": WAN_LOW, "weight_dtype": "default"}},
        "lora_high": {"class_type": "LoraLoaderModelOnly",
                      "inputs": {"model": ["unet_high", 0], "lora_name": WAN_LORA_HIGH, "strength_model": 1.0}},
        "lora_low": {"class_type": "LoraLoaderModelOnly",
                     "inputs": {"model": ["unet_low", 0], "lora_name": WAN_LORA_LOW, "strength_model": 1.0}},
        "shift_high": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["lora_high", 0], "shift": WAN_SHIFT}},
        "shift_low": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["lora_low", 0], "shift": WAN_SHIFT}},
        "clip": {"class_type": "CLIPLoader", "inputs": {"clip_name": WAN_TEXT_ENCODER, "type": "wan", "device": "default"}},
        "vae": {"class_type": "VAELoader", "inputs": {"vae_name": WAN_VAE}},
    }


def _wan_sampling(conditioning_node: str, seed: int, prefix: str) -> dict:
    common = {"steps": WAN_STEPS, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple",
              "positive": [conditioning_node, 0], "negative": [conditioning_node, 1]}
    return {
        "sample_high": {"class_type": "KSamplerAdvanced", "inputs": {
            **common, "model": ["shift_high", 0], "add_noise": "enable", "noise_seed": seed,
            "latent_image": [conditioning_node, 2], "start_at_step": 0, "end_at_step": WAN_SPLIT_STEP,
            "return_with_leftover_noise": "enable"}},
        "sample_low": {"class_type": "KSamplerAdvanced", "inputs": {
            **common, "model": ["shift_low", 0], "add_noise": "disable", "noise_seed": seed,
            "latent_image": ["sample_high", 0], "start_at_step": WAN_SPLIT_STEP, "end_at_step": WAN_STEPS,
            "return_with_leftover_noise": "disable"}},
        "decode": {"class_type": "VAEDecode", "inputs": {"samples": ["sample_low", 0], "vae": ["vae", 0]}},
        # Frames are saved as PNGs and muxed locally with ffmpeg (SaveVideo's dynamic-combo inputs changed across versions).
        "save": {"class_type": "SaveImage", "inputs": {"images": ["decode", 0], "filename_prefix": prefix}},
    }


def _wan_text(prompt: str) -> dict:
    return {
        "pos": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["clip", 0]}},
        "neg": {"class_type": "CLIPTextEncode", "inputs": {"text": WAN_NEGATIVE, "clip": ["clip", 0]}},
    }


def wan_i2v(start_image: str, prompt: str, seed: int, width: int = 1280, height: int = 720,
            length: int = 81, prefix: str = "clip") -> dict:
    """start_image: a ComfyUI annotated name, e.g. 'kf_00001_.png [output]'."""
    return {
        **_wan_models(),
        **_wan_text(prompt),
        "start": {"class_type": "LoadImage", "inputs": {"image": start_image}},
        "cond": {"class_type": "WanImageToVideo", "inputs": {
            "positive": ["pos", 0], "negative": ["neg", 0], "vae": ["vae", 0], "start_image": ["start", 0],
            "width": width, "height": height, "length": length, "batch_size": 1}},
        **_wan_sampling("cond", seed, prefix),
    }


def wan_flf2v(start_image: str, end_image: str, prompt: str, seed: int, width: int = 1280,
              height: int = 720, length: int = 81, prefix: str = "clip") -> dict:
    """First-last-frame clip: used for seamless idle loops and hub-to-branch transitions."""
    return {
        **_wan_models(),
        **_wan_text(prompt),
        "start": {"class_type": "LoadImage", "inputs": {"image": start_image}},
        "end": {"class_type": "LoadImage", "inputs": {"image": end_image}},
        "cond": {"class_type": "WanFirstLastFrameToVideo", "inputs": {
            "positive": ["pos", 0], "negative": ["neg", 0], "vae": ["vae", 0], "start_image": ["start", 0],
            "end_image": ["end", 0], "width": width, "height": height, "length": length, "batch_size": 1}},
        **_wan_sampling("cond", seed, prefix),
    }

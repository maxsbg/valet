"""Freistell-Server auf Modal (Grafikkarte T4, startet nur bei Bedarf).

Einspielen:  modal deploy services/freistellen/modal_app.py
Derselbe Server wie im Hugging Face Space (server.py), hier mit Grafikkarte.
"""
import modal

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "torch==2.15.0", "torchvision==0.29.2", "transformers==5.22.2", "timm==1.0.31", "kornia==0.9.0",
        "einops==0.8.2", "safetensors==0.8.0", "huggingface_hub==2.4.0", "opencv-python-headless==4.12.0.88",
        "pillow==12.3.0", "numpy==2.5.3", "fastapi==0.128.0",
    )
    # Modell ins Image legen: kein Download beim Start
    .run_commands(
        "python -c \"from huggingface_hub import snapshot_download; snapshot_download('ZhengPeng7/BiRefNet_dynamic', "
        "local_dir='/model', allow_patterns=['*.py','*.json','model.safetensors'])\""
    )
    .env({"MODEL_DIR": "/model", "HF_HUB_OFFLINE": "1"})
    .add_local_file(__file__.replace("modal_app.py", "server.py"), "/root/server.py")
)

app = modal.App("valet-freistellen", image=image)


# scaledown_window klein halten: Leerlauf kostet Guthaben. max_containers=1 begrenzt die Kosten.
@app.function(gpu="T4", cpu=2, memory=8192, scaledown_window=20, max_containers=1, timeout=120)
@modal.concurrent(max_inputs=4)
@modal.asgi_app()
def web():
    import server
    server.model()  # beim Start laden
    return server.app

import os

class Settings:
    PROJECT_NAME: str = "DocTriage AI Engine"
    API_V1_STR: str = "/api/v1"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    
    BASE_DIR: str = os.path.dirname(os.path.abspath(__file__)) 
    # Primary shared uploads directory (services/shared_uploads)
    SHARED_UPLOADS_DIR: str = os.getenv(
        "SHARED_UPLOADS_DIR",
        os.path.abspath(os.path.join(BASE_DIR, "..", "shared_uploads"))
    )
    # Secondary root shared uploads directory for testing/fixtures (shared_uploads/)
    ROOT_UPLOADS_DIR: str = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "shared_uploads"))

settings = Settings()
from fastapi import HTTPException, status


class NMSCBException(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(NMSCBException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(f"{resource} not found", status_code=404)


class ForbiddenError(NMSCBException):
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message, status_code=403)


class UnauthorizedError(NMSCBException):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(message, status_code=401)


class ConflictError(NMSCBException):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message, status_code=409)


class ValidationError(NMSCBException):
    def __init__(self, message: str):
        super().__init__(message, status_code=422)


# HTTP shortcuts
def raise_404(resource: str = "Resource") -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource} not found")


def raise_403(detail: str = "Insufficient permissions") -> None:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def raise_401(detail: str = "Not authenticated") -> None:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )

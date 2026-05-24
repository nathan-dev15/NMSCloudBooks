from app.workers.celery_app import celery_app


@celery_app.task(name="send_email")
def send_email(to: str, subject: str, body: str) -> dict:
    # TODO: integrate with email provider (SendGrid / SES)
    return {"status": "queued", "to": to}


@celery_app.task(name="generate_report")
def generate_report(report_type: str, tenant_id: int, params: dict) -> dict:
    # TODO: implement report generation
    return {"status": "queued", "report_type": report_type}


@celery_app.task(name="send_otp")
def send_otp(phone: str, otp: str) -> dict:
    # TODO: integrate with SMS gateway
    return {"status": "queued", "phone": phone}

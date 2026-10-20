FROM python:3.12-slim

WORKDIR /etl

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY pipeline.py generate_sessions.py ./
COPY fixtures ./fixtures

RUN useradd --create-home etl && chown -R etl /etl
USER etl

ENTRYPOINT ["python", "pipeline.py"]
CMD ["--csv", "fixtures/sessions_400.csv", "--report", "artifacts/quality_report.json"]

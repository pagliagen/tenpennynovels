.PHONY: start stop dev logs pull-models health ngrok

start:
	docker compose up -d

stop:
	docker compose down

dev:
	docker compose up -d ollama mongodb
	@echo "Ollama and MongoDB started. Run services manually or use 'npm run dev' in each service."

logs:
	docker compose logs -f

pull-models:
	docker compose exec ollama ollama pull mistral:7b-instruct

health:
	@curl -s http://localhost:9000/health | python3 -m json.tool 2>/dev/null || echo "Gateway not running"

ngrok:
	ngrok start --config ngrok.yml ai-gateway

start-all:
	docker compose --profile image-gen up -d

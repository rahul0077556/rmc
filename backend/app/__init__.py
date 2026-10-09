import os
from flask import Flask, jsonify
from backend.app.config import Config, DevelopmentConfig, ProductionConfig, TestingConfig
from backend.app.extensions import db, migrate, jwt, cors, swagger
from backend.app.utils.responses import error_response

def create_app(config_class=None):
    app = Flask(__name__)
    
    if config_class is None:
        env = os.getenv("FLASK_ENV", "development")
        if env == "production":
            config_class = ProductionConfig
        elif env == "testing":
            config_class = TestingConfig
        else:
            config_class = DevelopmentConfig

    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})
    swagger.init_app(app)

    # JWT Error Handlers
    @jwt.unauthorized_loader
    def unauthorized_callback(callback):
        return error_response(code="UNAUTHORIZED", message="Authorization header missing or invalid token.", status_code=401)

    @jwt.invalid_token_loader
    def invalid_token_callback(callback):
        return error_response(code="INVALID_TOKEN", message="Signature verification failed or token is malformed.", status_code=401)

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return error_response(code="TOKEN_EXPIRED", message="The access token has expired.", status_code=401)

    # Global HTTP Error Handlers
    @app.errorhandler(404)
    def handle_404(e):
        return error_response(code="NOT_FOUND", message="Requested endpoint or resource was not found.", status_code=404)

    @app.errorhandler(405)
    def handle_405(e):
        return error_response(code="METHOD_NOT_ALLOWED", message="HTTP method is not allowed on this endpoint.", status_code=405)

    @app.errorhandler(500)
    def handle_500(e):
        return error_response(code="INTERNAL_SERVER_ERROR", message="An unexpected server error occurred.", status_code=500)

    # Register Blueprints
    from backend.app.blueprints.auth import auth_bp
    from backend.app.blueprints.master import master_bp
    from backend.app.blueprints.orders import orders_bp
    from backend.app.blueprints.trips import trips_bp
    from backend.app.blueprints.production import production_bp
    from backend.app.blueprints.qa import qa_bp
    from backend.app.blueprints.billing import billing_bp
    from backend.app.blueprints.dashboard import dashboard_bp
    from backend.app.blueprints.reports import reports_bp
    from backend.app.blueprints.notifications import notifications_bp
    from backend.app.blueprints.customer_portal import portal_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(master_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(trips_bp)
    app.register_blueprint(production_bp)
    app.register_blueprint(qa_bp)
    app.register_blueprint(billing_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(portal_bp)

    # Healthcheck
    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "healthy", "service": "rmc-backend", "version": "1.0.0"})

    # Register CLI seed command
    from backend.commands.seed import seed_cli
    app.cli.add_command(seed_cli, name="seed")

    return app

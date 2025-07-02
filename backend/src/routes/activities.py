from flask import Blueprint, request, jsonify
from src.models.user import db
from src.models.activity import Activity

activities_bp = Blueprint('activities', __name__)

@activities_bp.route('/activities', methods=['GET'])
def get_activities():
    """Get all activities, ordered by date (most recent first)"""
    try:
        limit = request.args.get('limit', 50, type=int)
        activities = Activity.query.order_by(Activity.date.desc()).limit(limit).all()
        return jsonify([activity.to_dict() for activity in activities])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@activities_bp.route('/activities/<activity_id>', methods=['GET'])
def get_activity(activity_id):
    """Get a specific activity by ID"""
    try:
        activity = Activity.query.get_or_404(activity_id)
        return jsonify(activity.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


"""Add email privacy controls

Revision ID: add_email_privacy_controls
Revises: 
Create Date: 2025-01-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_email_privacy_controls'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add privacy fields to contacts table
    op.add_column('contacts', sa.Column('is_shared', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('contacts', sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.add_column('contacts', sa.Column('shared_with_team', sa.Boolean(), server_default='false', nullable=False))
    
    # Add privacy fields to email_threads table
    op.add_column('email_threads', sa.Column('is_private', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('email_threads', sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.add_column('email_threads', sa.Column('shared_with', sa.JSON(), nullable=True))  # Array of user IDs
    
    # Add email sync settings to o365_user_connections table
    op.add_column('o365_user_connections', sa.Column('sync_only_crm_contacts', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('o365_user_connections', sa.Column('excluded_domains', sa.JSON(), nullable=True))  # Array of domains to exclude
    op.add_column('o365_user_connections', sa.Column('excluded_keywords', sa.JSON(), nullable=True))  # Array of keywords to exclude
    op.add_column('o365_user_connections', sa.Column('auto_create_contacts', sa.Boolean(), server_default='false', nullable=False))
    
    # Create email sharing permissions table
    op.create_table('email_sharing_permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email_thread_id', sa.Integer(), sa.ForeignKey('email_threads.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('permission_level', sa.String(50), nullable=False),  # read, write
        sa.Column('granted_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email_thread_id', 'user_id')
    )
    
    # Create index for performance
    op.create_index('idx_contacts_owner_shared', 'contacts', ['owner_id', 'shared_with_team'])
    op.create_index('idx_email_threads_owner_private', 'email_threads', ['owner_id', 'is_private'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_email_threads_owner_private', table_name='email_threads')
    op.drop_index('idx_contacts_owner_shared', table_name='contacts')
    
    # Drop table
    op.drop_table('email_sharing_permissions')
    
    # Remove columns
    op.drop_column('o365_user_connections', 'auto_create_contacts')
    op.drop_column('o365_user_connections', 'excluded_keywords')
    op.drop_column('o365_user_connections', 'excluded_domains')
    op.drop_column('o365_user_connections', 'sync_only_crm_contacts')
    
    op.drop_column('email_threads', 'shared_with')
    op.drop_column('email_threads', 'owner_id')
    op.drop_column('email_threads', 'is_private')
    
    op.drop_column('contacts', 'shared_with_team')
    op.drop_column('contacts', 'owner_id')
    op.drop_column('contacts', 'is_shared')
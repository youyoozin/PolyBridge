
# join_room 이벤트 핸들러 (1:1 채팅방 입장)



from flask import Flask, request, redirect, url_for, session, flash, render_template, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, join_room, leave_room, send
from datetime import datetime
import re
from collections import Counter


app = Flask("정치 커뮤니티 웹")
app.secret_key = 'your_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///community.db'
db = SQLAlchemy(app)
socketio = SocketIO(app)

def extract_keywords(text):
    words = re.findall(r'\w+', text)
    return [w for w in words if len(w) > 1]

def get_trending_keywords():
    all_text = ''
    for post in Post.query.all():
        all_text += ' ' + post.title + ' ' + post.content
    for comment in Comment.query.all():
        all_text += ' ' + comment.content
    keywords = extract_keywords(all_text)
    counter = Counter(keywords)
    return [kw for kw, _ in counter.most_common(10)]

@app.route('/delete/<int:post_id>', methods=['POST'])
def delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    if post.user_id != session.get('user_id'):
        flash('본인만 삭제할 수 있습니다.')
        return redirect(url_for('index'))
    db.session.delete(post)
    db.session.commit()
    flash('게시물이 삭제되었습니다.')
    return redirect(url_for('index'))

BAD_WORDS = ['비속어1', '비속어2', '욕설']

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(30))
    phone = db.Column(db.String(20), unique=True, nullable=False)
    gender = db.Column(db.String(10))
    age = db.Column(db.Integer)
    job = db.Column(db.String(50))
    party = db.Column(db.String(20))
    unique_code = db.Column(db.String(10), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    title = db.Column(db.String(200))
    content = db.Column(db.Text)
    source = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    likes = db.Column(db.Integer, default=0)

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    content = db.Column(db.Text)
    source = db.Column(db.String(200))
    stance = db.Column(db.String(10))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    likes = db.Column(db.Integer, default=0)

# 키워드 추출 함수 (간단하게 띄어쓰기 기준 분리)
def filter_bad_words(text):
    for word in BAD_WORDS:
        text = re.sub(word, '*'*len(word), text, flags=re.IGNORECASE)
    return text

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form['name']
        phone = request.form['phone']
        gender = request.form['gender']
        age = int(request.form['age'])
        job = request.form['job']
        party = request.form['party']
        if User.query.filter_by(phone=phone).first():
            flash('이미 가입된 전화번호입니다.')
            return redirect(url_for('register'))
        unique_code = f"{gender[0]}{age}{party[0]}"
        user = User(name=name, phone=phone, gender=gender, age=age, job=job, party=party, unique_code=unique_code)
        db.session.add(user)
        db.session.commit()
        flash('회원가입 완료!')
        return redirect(url_for('login'))
    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        phone = request.form['phone']
        user = User.query.filter_by(phone=phone).first()
        if user:
            session['user_id'] = user.id
            session['user_name'] = user.name
            flash('로그인 성공!')
            return redirect(url_for('index'))
        else:
            flash('회원정보가 없습니다.')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('로그아웃되었습니다.')
    return redirect(url_for('index'))

@app.route('/')
def index():
    posts = Post.query.order_by(Post.created_at.desc()).all()
    trending_keywords = get_trending_keywords()
    return render_template('index.html', posts=posts, trending_keywords=trending_keywords)

@app.route('/create', methods=['GET', 'POST'])
def create_post():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    if request.method == 'POST':
        title = request.form['title']
        content = filter_bad_words(request.form['content'])
        source = request.form['source']
        post = Post(user_id=session['user_id'], title=title, content=content, source=source)
        db.session.add(post)
        db.session.commit()
        flash('게시물 등록 완료!')
        return redirect(url_for('index'))
    return render_template('create.html')

@app.route('/post/<int:post_id>', methods=['GET', 'POST'])
def post_detail(post_id):
    post = Post.query.get_or_404(post_id)
    comments = Comment.query.filter_by(post_id=post_id).all()
    if request.method == 'POST':
        if 'user_id' not in session:
            return redirect(url_for('login'))
        content = filter_bad_words(request.form['content'])
        source = request.form['source']
        stance = request.form['stance']
        comment = Comment(post_id=post_id, user_id=session['user_id'], content=content, source=source, stance=stance)
        db.session.add(comment)
        db.session.commit()
        flash('댓글 등록 완료!')
        return redirect(url_for('post_detail', post_id=post_id))
    return render_template('post_detail.html', post=post, comments=comments)


# 단체 채팅방
@app.route('/chatroom')
def group_chat():
    return render_template('group_chat.html')

# 1:1 채팅방 (url: /chat/<username>)
@app.route('/chat/<username>')
def private_chat(username):
    return render_template('private_chat.html', username=username)

# 소켓 이벤트: 단체 채팅방
@socketio.on('group_message')
def handle_group_message(data):
    send({'msg': data['msg'], 'user': data['user']}, broadcast=True)

# 소켓 이벤트: 1:1 채팅방
@socketio.on('private_message')
def handle_private_message(data):
    room = data['room']
    send({'msg': data['msg'], 'user': data['user']}, room=room)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=True)
/**
 * MockPro - Local Storage Exam Engine
 * Features: Reusable Themes, Q-Timer, Sectional Timing, No Backend
 */

const DB = {
    get: (key) => JSON.parse(localStorage.getItem(key) || 'null'),
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
    init: () => {
        if (!DB.get('mock_tests')) DB.set('mock_tests',[]);
        if (!DB.get('test_history')) DB.set('test_history',[]);
        if (!DB.get('saved_templates')) DB.set('saved_templates',[]); // Theme Library
        
        const theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
    }
};

// ==============================================
// 1. ROUTER & INITIALIZATION
// ==============================================
document.addEventListener('DOMContentLoaded', () => {
    DB.init();
    
    const themeBtn = document.getElementById('theme-toggle');
    if(themeBtn) {
        themeBtn.addEventListener('click', () => {
            const cur = document.documentElement.getAttribute('data-theme');
            const nxt = cur === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nxt);
            localStorage.setItem('theme', nxt);
        });
    }

    const page = document.body.id;
    if (page === 'page-dashboard') Dashboard.init();
    if (page === 'page-admin') Admin.init();
    if (page === 'page-test') ExamEngine.init();
    if (page === 'page-result') ResultView.init(); // (Same as before, assumed existing)
});

// ==============================================
// 2. DASHBOARD CONTROLLER
// ==============================================
const Dashboard = {
    init: () => {
        Dashboard.renderTests();
        Dashboard.renderHistory();
        Dashboard.renderStats();
    },
    renderTests: () => {
        const tests = DB.get('mock_tests') ||[];
        const container = document.getElementById('test-list');
        container.innerHTML = tests.map(t => `
            <div class="card test-card">
                <h3>${t.testName}</h3>
                <div class="meta">
                    ⏳ ${t.duration} Mins &nbsp; | &nbsp; 
                    📝 ${t.sections.reduce((acc, s) => acc + s.questions.length, 0)} Questions
                </div>
                <button class="btn btn-primary" onclick="Dashboard.startTest('${t.id}')">Start Test</button>
            </div>
        `).join('') || '<p>No Tests Available. Create one from Admin Panel.</p>';
    },
    renderHistory: () => {
        const history = DB.get('test_history') ||[];
        const tbody = document.getElementById('history-list');
        tbody.innerHTML = history.reverse().map(h => `
            <tr>
                <td>${new Date(h.date).toLocaleDateString()}</td>
                <td>${h.testName}</td>
                <td>${h.score}</td>
                <td>${h.accuracy}%</td>
                <td><button class="btn btn-outline" onclick="Dashboard.viewResult('${h.sessionId}')">View</button></td>
            </tr>
        `).join('') || `<tr><td colspan="5">No tests taken yet.</td></tr>`;
    },
    renderStats: () => {
        const history = DB.get('test_history') ||[];
        document.getElementById('total-tests-taken').textContent = history.length;
        if(history.length > 0) {
            const avgAcc = history.reduce((sum, h) => sum + parseFloat(h.accuracy), 0) / history.length;
            document.getElementById('overall-accuracy').textContent = avgAcc.toFixed(1);
        }
    },
    startTest: (testId) => {
        const tests = DB.get('mock_tests');
        const test = tests.find(t => t.id === testId);
        
        let flatQuestions =[];
        let globalIndex = 0;
        let sections = JSON.parse(JSON.stringify(test.sections));
        
        sections.forEach((sec, sIdx) => {
            if(test.shuffle) sec.questions.sort(() => Math.random() - 0.5);
            sec.questions.forEach((q, qIdx) => {
                if(test.shuffle) {
                    let opts = q.options.map((o, i) => ({txt: o, isAns: i === q.a}));
                    opts.sort(() => Math.random() - 0.5);
                    q.options = opts.map(o => o.txt);
                    q.a = opts.findIndex(o => o.isAns);
                }
                flatQuestions.push({
                    gIdx: globalIndex++,
                    sIdx: sIdx,
                    secName: sec.name,
                    qIdx: qIdx,
                    qData: q,
                    status: 'not-visited',
                    userAnswer: null,
                    timeSpent: 0
                });
            });
        });

        const session = {
            sessionId: 'sess_' + Date.now(),
            testId: test.id,
            testName: test.testName,
            config: test.config || { duration: test.duration, marks: test.marks, negative: test.negative },
            template: test.template,
            sections: sections,
            questions: flatQuestions,
            activeGIdx: 0,
            timeLeft: test.duration * 60,
            violations: 0,
            
            // Sectional Timing Logic
            currentActiveSection: 0,
            sectionTimeLeft: 0
        };

        // If Sectional Timing is ON, divide time equally per section
        if (session.config.sectionalTiming) {
            session.sectionTimeLeft = (test.duration * 60) / sections.length;
        }

        DB.set('current_session', session);
        window.location.href = 'test.html';
    },
    viewResult: (sessId) => {
        DB.set('view_result_id', sessId);
        window.location.href = 'result.html';
    }
};

// ==============================================
// 3. ADMIN CONTROLLER
// ==============================================
const Admin = {
    init: () => {
        let uploadedJson = null;
        let uploadedHtml = '';

        // Load saved templates into dropdown
        const templates = DB.get('saved_templates') ||[];
        const templateDropdown = document.getElementById('saved-templates-dropdown');
        templates.forEach((tpl, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = tpl.name;
            templateDropdown.appendChild(opt);
        });

        // Dropdown Selection Event
        templateDropdown.addEventListener('change', (e) => {
            if(e.target.value !== "") {
                uploadedHtml = templates[e.target.value].html;
                document.getElementById('html-preview').value = uploadedHtml;
            } else {
                uploadedHtml = '';
                document.getElementById('html-preview').value = '';
            }
        });

        // HTML Upload Event
        document.getElementById('html-upload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (evt) => {
                uploadedHtml = evt.target.result;
                document.getElementById('html-preview').value = uploadedHtml;
                templateDropdown.value = ""; // Reset dropdown
                alert('Template Loaded Successfully!');
            };
            reader.readAsText(file);
        });

        // Toggle Template Save Input
        document.getElementById('save-template-check').addEventListener('change', (e) => {
            document.getElementById('template-name-group').classList.toggle('hidden', !e.target.checked);
        });

        // JSON Upload Event
        document.getElementById('json-upload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    uploadedJson = JSON.parse(evt.target.result);
                    alert('JSON Loaded Successfully!');
                    if(uploadedJson.duration) document.getElementById('cfg-duration').value = uploadedJson.duration;
                } catch(err) { alert('Invalid JSON file format.'); }
            };
            reader.readAsText(file);
        });

        // Save Test
        document.getElementById('save-test-btn').addEventListener('click', () => {
            if(!uploadedJson || !uploadedJson.sections) return alert('Please upload valid JSON first.');
            
            // Save Template to Library Logic
            if(document.getElementById('save-template-check').checked) {
                let tplName = document.getElementById('new-template-name').value || 'My Custom Template';
                let lib = DB.get('saved_templates') ||[];
                lib.push({ name: tplName, html: uploadedHtml });
                DB.set('saved_templates', lib);
            }

            const newTest = {
                id: 'test_' + Date.now(),
                testName: uploadedJson.testName || 'Custom Mock Test',
                duration: parseFloat(document.getElementById('cfg-duration').value),
                marks: parseFloat(document.getElementById('cfg-marks').value),
                negative: parseFloat(document.getElementById('cfg-negative').value),
                shuffle: document.getElementById('cfg-shuffle').checked,
                template: uploadedHtml,
                sections: uploadedJson.sections,
                config: {
                    duration: parseFloat(document.getElementById('cfg-duration').value),
                    marks: parseFloat(document.getElementById('cfg-marks').value),
                    negative: parseFloat(document.getElementById('cfg-negative').value),
                    strict: document.getElementById('cfg-strict').checked,
                    showQTimer: document.getElementById('cfg-q-timer').checked, // NEW
                    sectionalTiming: document.getElementById('cfg-sec-timing').checked // NEW
                }
            };

            const tests = DB.get('mock_tests') ||[];
            tests.push(newTest);
            DB.set('mock_tests', tests);
            alert('Test Saved Successfully!');
            window.location.href = 'index.html';
        });
    }
};

// ==============================================
// 4. EXAM ENGINE
// ==============================================
const ExamEngine = {
    session: null,
    timerInterval: null,
    
    init: () => {
        ExamEngine.session = DB.get('current_session');
        if(!ExamEngine.session) {
            window.location.href = 'index.html';
            return;
        }

        // Feature: Per-Question Timer Wrapper Visibility
        if(ExamEngine.session.config.showQTimer) {
            document.getElementById('q-timer-wrapper').classList.remove('hidden');
        }

        // Tab Switch Warning
        if(ExamEngine.session.config.strict) {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    ExamEngine.session.violations++;
                    document.getElementById('warning-overlay').classList.remove('hidden');
                    if(ExamEngine.session.violations > 3) ExamEngine.submitTest();
                }
            });
        }

        document.getElementById('live-test-name').textContent = ExamEngine.session.testName;
        ExamEngine.renderSectionTabs();
        ExamEngine.startTimer();
        ExamEngine.loadQuestion(ExamEngine.session.activeGIdx);

        document.getElementById('btn-next').addEventListener('click', () => ExamEngine.handleNext(true));
        document.getElementById('btn-mark').addEventListener('click', () => ExamEngine.handleMark());
        document.getElementById('btn-prev').addEventListener('click', () => ExamEngine.handlePrev());
        document.getElementById('btn-clear').addEventListener('click', () => ExamEngine.clearResponse());
        document.getElementById('btn-submit').addEventListener('click', () => {
            if(confirm('Are you sure you want to submit the test?')) ExamEngine.submitTest();
        });
    },

    startTimer: () => {
        ExamEngine.timerInterval = setInterval(() => {
            ExamEngine.session.timeLeft--;
            ExamEngine.session.questions[ExamEngine.session.activeGIdx].timeSpent++;
            
            // Q-Timer Update
            if(ExamEngine.session.config.showQTimer) {
                const spent = ExamEngine.session.questions[ExamEngine.session.activeGIdx].timeSpent;
                const min = String(Math.floor(spent / 60)).padStart(2, '0');
                const sec = String(spent % 60).padStart(2, '0');
                document.getElementById('q-timer-display').textContent = `${min}:${sec}`;
            }

            // Global Auto-save
            if(ExamEngine.session.timeLeft % 5 === 0) DB.set('current_session', ExamEngine.session);

            // SECTIONAL TIMING LOGIC
            if (ExamEngine.session.config.sectionalTiming) {
                ExamEngine.session.sectionTimeLeft--;
                const st = ExamEngine.session.sectionTimeLeft;
                
                // Show section time instead of overall
                const h = String(Math.floor(st / 3600)).padStart(2, '0');
                const m = String(Math.floor((st % 3600) / 60)).padStart(2, '0');
                const s = String(st % 60).padStart(2, '0');
                const timerEl = document.getElementById('timer-display');
                timerEl.textContent = `${h}:${m}:${s} (Section)`;
                timerEl.parentElement.classList.add('section-timer-alert');

                if (st <= 0) {
                    ExamEngine.session.currentActiveSection++;
                    if (ExamEngine.session.currentActiveSection >= ExamEngine.session.sections.length) {
                        clearInterval(ExamEngine.timerInterval);
                        alert('Test Time is up! Auto-submitting...');
                        ExamEngine.submitTest();
                    } else {
                        alert('Section Time Up! Moving to next section. You cannot return to previous sections.');
                        ExamEngine.session.sectionTimeLeft = (ExamEngine.session.config.duration * 60) / ExamEngine.session.sections.length;
                        
                        // Find first question of newly active section
                        const nextQIdx = ExamEngine.session.questions.findIndex(q => q.sIdx === ExamEngine.session.currentActiveSection);
                        ExamEngine.loadQuestion(nextQIdx);
                        ExamEngine.renderSectionTabs();
                    }
                }
            } 
            // NORMAL GLOBAL TIMING
            else {
                const t = ExamEngine.session.timeLeft;
                if(t <= 0) {
                    clearInterval(ExamEngine.timerInterval);
                    alert('Time is up! Auto-submitting...');
                    ExamEngine.submitTest();
                    return;
                }
                const h = String(Math.floor(t / 3600)).padStart(2, '0');
                const m = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
                const s = String(t % 60).padStart(2, '0');
                document.getElementById('timer-display').textContent = `${h}:${m}:${s}`;
            }
        }, 1000);
    },

    renderSectionTabs: () => {
        const tabsContainer = document.getElementById('section-tabs');
        tabsContainer.innerHTML = ExamEngine.session.sections.map((sec, i) => {
            // If sectional timing is active, lock all sections except the active one
            let lockClass = '';
            if (ExamEngine.session.config.sectionalTiming && i !== ExamEngine.session.currentActiveSection) {
                lockClass = 'locked';
            }
            return `<div class="section-tab ${lockClass}" id="tab-${i}" onclick="ExamEngine.jumpToSection(${i})">${sec.name}</div>`;
        }).join('');
    },

    jumpToSection: (sIdx) => {
        // Prevent jumping if sectional timing is strictly locked
        if (ExamEngine.session.config.sectionalTiming && sIdx !== ExamEngine.session.currentActiveSection) {
            return;
        }
        const qIdx = ExamEngine.session.questions.findIndex(q => q.sIdx === sIdx);
        if(qIdx !== -1) ExamEngine.loadQuestion(qIdx);
    },

    loadQuestion: (gIdx) => {
        if(gIdx < 0 || gIdx >= ExamEngine.session.questions.length) return;
        
        const curQTarget = ExamEngine.session.questions[gIdx];

        // Section Boundary check
        if (ExamEngine.session.config.sectionalTiming && curQTarget.sIdx !== ExamEngine.session.currentActiveSection) {
            return;
        }

        const prevQ = ExamEngine.session.questions[ExamEngine.session.activeGIdx];
        if(prevQ && prevQ.status === 'not-visited') prevQ.status = 'not-answered';

        ExamEngine.session.activeGIdx = gIdx;
        const curQ = ExamEngine.session.questions[gIdx];
        
        if(curQ.status === 'not-visited') curQ.status = 'not-answered';

        document.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
        const activeTab = document.getElementById(`tab-${curQ.sIdx}`);
        if(activeTab) activeTab.classList.add('active');
        document.getElementById('live-subject').textContent = curQ.secName;

        let optionsHtml = `<div class="custom-options">`;
        curQ.qData.options.forEach((opt, idx) => {
            const isChecked = curQ.userAnswer === idx ? 'checked' : '';
            optionsHtml += `
                <label>
                    <input type="radio" name="opt" value="${idx}" ${isChecked} onchange="ExamEngine.selectOption(${idx})">
                    ${opt}
                </label>
            `;
        });
        optionsHtml += `</div>`;

        let template = ExamEngine.session.template;
        if(!template || template.trim() === '') {
            template = `
                <div class="custom-q-num" style="font-size:18px;font-weight:bold;margin-bottom:15px;color:var(--primary)">Question {{questionNumber}}</div>
                <div style="font-size:16px;margin-bottom:20px;">{{question}}</div>
                <div>{{options}}</div>
            `;
        }

        const htmlOutput = template
            .replace(/{{questionNumber}}/g, curQ.gIdx + 1)
            .replace(/{{sectionName}}/g, curQ.secName)
            .replace(/{{question}}/g, curQ.qData.q)
            .replace(/{{options}}/g, optionsHtml);

        document.getElementById('exam-render-area').innerHTML = htmlOutput;
        ExamEngine.updatePaletteUI();
    },

    handleNext: (save) => {
        const curQ = ExamEngine.session.questions[ExamEngine.session.activeGIdx];
        if(save && curQ.userAnswer !== null) curQ.status = 'answered';
        
        const nextIdx = ExamEngine.session.activeGIdx + 1;
        if(nextIdx < ExamEngine.session.questions.length) {
            // Check boundary for Sectional Timing
            if(ExamEngine.session.config.sectionalTiming && ExamEngine.session.questions[nextIdx].sIdx !== ExamEngine.session.currentActiveSection) {
                alert('You have reached the end of this Section. Review your answers and wait for section time to complete.');
                return;
            }
            ExamEngine.loadQuestion(nextIdx);
        }
    },

    handlePrev: () => {
        const prevIdx = ExamEngine.session.activeGIdx - 1;
        if(prevIdx >= 0) {
            if(ExamEngine.session.config.sectionalTiming && ExamEngine.session.questions[prevIdx].sIdx !== ExamEngine.session.currentActiveSection) {
                return; // Boundary locked
            }
            ExamEngine.loadQuestion(prevIdx);
        }
    },

    handleMark: () => {
        const curQ = ExamEngine.session.questions[ExamEngine.session.activeGIdx];
        if(curQ.userAnswer !== null) curQ.status = 'marked-answered';
        else curQ.status = 'marked';
        ExamEngine.handleNext(false);
    },

    selectOption: (val) => {
        const curQ = ExamEngine.session.questions[ExamEngine.session.activeGIdx];
        curQ.userAnswer = val;
        if(curQ.status === 'marked' || curQ.status === 'marked-answered') curQ.status = 'marked-answered';
        else curQ.status = 'answered';
        ExamEngine.updatePaletteUI();
    },

    clearResponse: () => {
        const curQ = ExamEngine.session.questions[ExamEngine.session.activeGIdx];
        curQ.userAnswer = null;
        curQ.status = 'not-answered';
        const radios = document.getElementsByName('opt');
        radios.forEach(r => r.checked = false);
        ExamEngine.updatePaletteUI();
    },

    updatePaletteUI: () => {
        const palette = document.getElementById('palette-grid');
        const curSIdx = ExamEngine.session.questions[ExamEngine.session.activeGIdx].sIdx;
        const sectionQuestions = ExamEngine.session.questions.filter(q => q.sIdx === curSIdx);
        
        palette.innerHTML = sectionQuestions.map(q => {
            let btnClass = q.status;
            if(q.status === 'marked-answered') btnClass = 'marked answered';
            return `<button class="palette-btn ${btnClass}" onclick="ExamEngine.loadQuestion(${q.gIdx})">${q.qIdx + 1}</button>`;
        }).join('');

        let ans = 0, nAns = 0, nVis = 0, mkd = 0;
        ExamEngine.session.questions.forEach(q => {
            if(q.status === 'answered' || q.status === 'marked-answered') ans++;
            else if(q.status === 'not-answered') nAns++;
            else if(q.status === 'not-visited') nVis++;
            else if(q.status === 'marked') mkd++;
        });
        document.querySelector('.palette-legend').innerHTML = `
            <div class="legend-item"><span class="badge answered">${ans}</span> Answered</div>
            <div class="legend-item"><span class="badge not-answered">${nAns}</span> Not Ans</div>
            <div class="legend-item"><span class="badge not-visited">${nVis}</span> Not Visit</div>
            <div class="legend-item"><span class="badge marked">${mkd}</span> Marked</div>
        `;
    },

    submitTest: () => {
        clearInterval(ExamEngine.timerInterval);
        const { questions, config, testName } = ExamEngine.session;
        let correct = 0, incorrect = 0, unattempted = 0, score = 0;

        questions.forEach(q => {
            if(q.userAnswer === null) unattempted++;
            else if (q.userAnswer === q.qData.a) { correct++; score += config.marks; }
            else { incorrect++; score -= config.negative; }
        });

        const resultData = {
            sessionId: ExamEngine.session.sessionId,
            testId: ExamEngine.session.testId,
            testName: testName,
            date: Date.now(),
            score: score,
            totalMarks: questions.length * config.marks,
            correct: correct, incorrect: incorrect, unattempted: unattempted,
            accuracy: correct + incorrect === 0 ? 0 : ((correct / (correct + incorrect)) * 100).toFixed(2),
            questions: questions, config: config
        };

        const history = DB.get('test_history') ||[];
        history.push(resultData);
        DB.set('test_history', history);
        localStorage.removeItem('current_session');
        
        DB.set('view_result_id', resultData.sessionId);
        window.location.href = 'result.html';
    }
};

// ==============================================
// 5. RESULT & ANALYSIS CONTROLLER (Continued)
// ==============================================
const ResultView = {
    init: () => {
        const sessId = DB.get('view_result_id');
        const history = DB.get('test_history') ||[];
        const result = history.find(h => h.sessionId === sessId);
        
        if(!result) {
            alert('Result not found.');
            window.location.href = 'index.html';
            return;
        }

        document.getElementById('result-test-name').textContent = result.testName;
        document.getElementById('result-score').textContent = result.score;
        document.getElementById('result-total-marks').textContent = result.totalMarks;
        
        document.getElementById('res-accuracy').textContent = result.accuracy + '%';
        document.getElementById('res-attempted').textContent = result.correct + result.incorrect;
        document.getElementById('res-correct').textContent = result.correct;
        document.getElementById('res-incorrect').textContent = result.incorrect;

        ResultView.renderBreakdown(result);
        ResultView.drawChart(result);
    },

    renderBreakdown: (result) => {
        const container = document.getElementById('solution-container');
        container.innerHTML = result.questions.map((q, i) => {
            let statusClass = 'skipped';
            let statusText = 'Not Attempted';
            
            if(q.userAnswer !== null) {
                if(q.userAnswer === q.qData.a) { statusClass = 'correct'; statusText = 'Correct'; }
                else { statusClass = 'incorrect'; statusText = 'Incorrect'; }
            }

            const optList = q.qData.options.map((opt, idx) => {
                let color = '';
                if(idx === q.qData.a) color = 'color: var(--success); font-weight: bold;';
                else if(idx === q.userAnswer && idx !== q.qData.a) color = 'color: var(--danger); text-decoration: line-through;';
                return `<li style="${color}">${opt}</li>`;
            }).join('');

            return `
                <div class="solution-item ${statusClass}">
                    <h4>Q${i+1} (${q.secName}): ${q.qData.q}</h4>
                    <p>Status: <strong>${statusText}</strong> | Time taken: ${q.timeSpent}s</p>
                    <ol type="A" style="margin-top: 10px; margin-left: 20px;">
                        ${optList}
                    </ol>
                </div>
            `;
        }).join('');
    },

    drawChart: (result) => {
        // Simple Vanilla JS Canvas Bar Chart for Section Analysis
        const canvas = document.getElementById('sectionChart');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Aggregate section data
        const secMap = {};
        result.questions.forEach(q => {
            if(!secMap[q.secName]) secMap[q.secName] = { total:0, score:0 };
            secMap[q.secName].total += result.config.marks;
            if(q.userAnswer === q.qData.a) secMap[q.secName].score += result.config.marks;
            else if(q.userAnswer !== null) secMap[q.secName].score -= result.config.negative;
        });

        const sections = Object.keys(secMap);
        const barWidth = 40;
        const spacing = 60;
        const startX = 50;
        
        // Draw axes
        ctx.beginPath();
        ctx.moveTo(30, 10);
        ctx.lineTo(30, 130);
        ctx.lineTo(380, 130);
        ctx.stroke();

        sections.forEach((sec, i) => {
            const data = secMap[sec];
            const maxH = 100; // max px height
            const height = Math.max(0, (data.score / data.total) * maxH); 
            
            // Draw Bar
            ctx.fillStyle = '#1a73e8';
            ctx.fillRect(startX + (i * spacing), 130 - height, barWidth, height);
            
            // Labels
            ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#fff' : '#000';
            ctx.font = '12px Arial';
            ctx.fillText(sec.substring(0,6), startX + (i * spacing), 145);
            ctx.fillText(data.score, startX + (i * spacing) + 10, 125 - height);
        });
    }
};
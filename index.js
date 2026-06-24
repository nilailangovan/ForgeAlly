document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Elements
    const navLinks = document.querySelectorAll('.nav-links a');
    const indicator = document.getElementById('nav-indicator');
    const ipad = document.getElementById('home-ipad');
    const subNavLinks = document.querySelectorAll('.sub-nav-links a');

    // ----------------------------------------------------
    // 1. Sliding Navbar Indicator Logic
    // ----------------------------------------------------
    function updateIndicator(activeLink) {
        if (!indicator || !activeLink) return;
        
        const offsetLeft = activeLink.offsetLeft;
        const width = activeLink.offsetWidth;

        indicator.style.left = `${offsetLeft}px`;
        indicator.style.width = `${width}px`;
    }

    function updateSubIndicator(activeLink) {
        if (!activeLink) return;
        const parentHeader = activeLink.closest('.support-sub-header, .community-sub-header');
        if (!parentHeader) return;
        const subIndicator = parentHeader.querySelector('.sub-nav-indicator');
        if (!subIndicator) return;
        
        const offsetLeft = activeLink.offsetLeft;
        const width = activeLink.offsetWidth;

        subIndicator.style.left = `${offsetLeft}px`;
        subIndicator.style.width = `${width}px`;
    }

    // ----------------------------------------------------
    // 2. iPad 3D Perspective Tilt Animation (Home section)
    // ----------------------------------------------------
    if (ipad) {
        const visualBlock = ipad.closest('.hero-visual-block');
        
        visualBlock.addEventListener('mousemove', (e) => {
            if (window.innerWidth <= 900) return; // Disable on tablets/mobile for layout stability

            const rect = ipad.getBoundingClientRect();
            // Calculate cursor offset relative to the center of the iPad card
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            // Limit the maximum angle tilt to 12 degrees
            const rx = -(y / (rect.height / 2)) * 12;
            const ry = (x / (rect.width / 2)) * 12;
            
            // Keep translateZ(0) so the mockup remains large from the beginning and does not scale on hover
            ipad.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        });

        visualBlock.addEventListener('mouseleave', () => {
            ipad.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
        });
    }

    // ----------------------------------------------------
    // 3. iPad Live Chat Typing Simulation Logic
    // ----------------------------------------------------
    const ipadChatMessages = document.getElementById('ipad-chat-messages');
    const ipadTypingIndicator = document.getElementById('ipad-typing-indicator');
    const ipadTypingText = ipadTypingIndicator ? ipadTypingIndicator.querySelector('.ipad-typing-text') : null;

    const mockMessages = [
        { sender: 'Nila', avatar: 'N', bg: 'bg-purple', text: 'hey', type: 'text' },
        { sender: 'Sidharth', avatar: 'S', bg: 'bg-green', text: 'hey hi', type: 'text' },
        { sender: 'Sidharth', avatar: 'S', bg: 'bg-green', text: 'can you share me the study materials', type: 'text' },
        { sender: 'Nila', avatar: 'N', bg: 'bg-purple', text: 'sure', type: 'text' },
        { sender: 'Nila', avatar: 'N', bg: 'bg-purple', text: '', type: 'pdf' }
    ];

    let typingTimer = null;
    let transitionTimer = null;
    let resetTimer = null;
    let simulationActive = false;

    function appendIpadMessage(sender, avatar, bgClass, text) {
        if (!ipadChatMessages) return;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-card-msg';
        msgDiv.innerHTML = `
            <div class="chat-avatar ${bgClass}">${avatar}</div>
            <div class="chat-msg-content">
                <div class="chat-msg-meta">
                    <span class="chat-author">${sender}</span>
                    <span class="chat-time">${timeStr}</span>
                </div>
                <p class="chat-text">${text}</p>
            </div>
        `;
        ipadChatMessages.appendChild(msgDiv);
        ipadChatMessages.scrollTop = ipadChatMessages.scrollHeight;
    }

    function appendIpadPdfMessage(sender, avatar, bgClass) {
        if (!ipadChatMessages) return;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-card-msg';
        msgDiv.innerHTML = `
            <div class="chat-avatar ${bgClass}">${avatar}</div>
            <div class="chat-msg-content" style="width: 100%;">
                <div class="chat-msg-meta">
                    <span class="chat-author">${sender}</span>
                    <span class="chat-time">${timeStr}</span>
                </div>
                <div class="pdf-attachment-card">
                    <div class="pdf-icon-box">
                        <i data-lucide="file-text"></i>
                    </div>
                    <div class="pdf-details">
                        <span class="pdf-name">Study-Materials.pdf</span>
                        <span class="pdf-size">4.2 MB</span>
                    </div>
                    <div class="pdf-download-btn">
                        <i data-lucide="download"></i>
                    </div>
                </div>
            </div>
        `;
        ipadChatMessages.appendChild(msgDiv);
        lucide.createIcons(); // Initialize the download and file icons inside the appended PDF card
        ipadChatMessages.scrollTop = ipadChatMessages.scrollHeight;
    }

    function runIpadSimulation(index = 0) {
        if (!simulationActive || !ipadTypingIndicator || !ipadTypingText) return;

        if (index >= mockMessages.length) {
            // End of message sequence: wait 5s and reset chat
            resetTimer = setTimeout(() => {
                if (ipadChatMessages) ipadChatMessages.innerHTML = '';
                runIpadSimulation(0);
            }, 5000);
            return;
        }

        const msg = mockMessages[index];

        // 1. Show typing indicator
        ipadTypingText.textContent = `${msg.sender} is typing`;
        ipadTypingIndicator.style.display = 'flex';
        if (ipadChatMessages) ipadChatMessages.scrollTop = ipadChatMessages.scrollHeight;

        // 2. Wait 1.4 seconds (typing speed simulation)
        typingTimer = setTimeout(() => {
            // Hide typing indicator
            ipadTypingIndicator.style.display = 'none';

            // Append standard text or PDF document card depending on message metadata
            if (msg.type === 'text') {
                appendIpadMessage(msg.sender, msg.avatar, msg.bg, msg.text);
            } else if (msg.type === 'pdf') {
                appendIpadPdfMessage(msg.sender, msg.avatar, msg.bg);
            }

            // 3. Wait 2.2 seconds before starting to type the next message
            transitionTimer = setTimeout(() => {
                runIpadSimulation(index + 1);
            }, 2200);
        }, 1400);
    }

    function startIpadSimulation() {
        if (simulationActive) return;
        simulationActive = true;
        if (ipadChatMessages) ipadChatMessages.innerHTML = '';
        runIpadSimulation(0);
    }

    function stopIpadSimulation() {
        simulationActive = false;
        clearTimeout(typingTimer);
        clearTimeout(transitionTimer);
        clearTimeout(resetTimer);
        if (ipadTypingIndicator) ipadTypingIndicator.style.display = 'none';
        if (ipadChatMessages) ipadChatMessages.innerHTML = '';
    }

    // ----------------------------------------------------
    // 4. SPA Section Switcher & Event Routing
    // ----------------------------------------------------
    function navigateToSection(targetId) {
        const sections = document.querySelectorAll('.empty-section, .hero-section');
        sections.forEach(sec => {
            if (sec.id === targetId) {
                sec.classList.add('active');
            } else {
                sec.classList.remove('active');
            }
        });

        // Reset scroll position to top when switching sections
        window.scrollTo(0, 0);

        // Re-initialize Lucide Icons when dynamic sections become visible
        lucide.createIcons();

        // Trigger simulation only when the "Home" page is visible
        if (targetId === 'home') {
            startIpadSimulation();
        } else {
            stopIpadSimulation();
        }
    }

    // Nav Link Clicks
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Let hashchange event handle actual routing
        });
    });

    // Handle initial routing based on window location hash
    function handleHashRouting() {
        const hash = window.location.hash || '#download'; // Default to download section on direct visits
        const isSupport = hash.startsWith('#support');
        const isCommunity = hash.startsWith('#community');
        
        let mainActiveLink;
        let targetSectionId;
        
        if (isSupport) {
            mainActiveLink = document.getElementById('nav-support');
            targetSectionId = 'support';
        } else if (isCommunity) {
            mainActiveLink = document.getElementById('nav-community');
            targetSectionId = 'community';
        } else {
            mainActiveLink = document.querySelector(`.nav-links a[href="${hash}"]`);
            targetSectionId = hash.substring(1);
        }
        
        if (mainActiveLink) {
            navLinks.forEach(item => item.classList.remove('active'));
            mainActiveLink.classList.add('active');
            updateIndicator(mainActiveLink);
            navigateToSection(targetSectionId);
        }
        
        // Handle support sub-routing
        const subHeader = document.getElementById('support-sub-header');
        if (subHeader) {
            if (isSupport) {
                subHeader.classList.add('visible');
                
                // Determine active sub-tab and active sub-view
                let activeSubTabId = 'sub-nav-help';
                let activeSubViewId = 'support-help';
                
                if (hash === '#support-feedback') {
                    activeSubTabId = 'sub-nav-feedback';
                    activeSubViewId = 'support-feedback';
                } else if (hash === '#support-request') {
                    activeSubTabId = 'sub-nav-request';
                    activeSubViewId = 'support-request';
                }
                
                const activeSubLink = document.getElementById(activeSubTabId);
                if (activeSubLink) {
                    const supportSubLinks = subHeader.querySelectorAll('.sub-nav-links a');
                    supportSubLinks.forEach(item => item.classList.remove('active'));
                    activeSubLink.classList.add('active');
                    setTimeout(() => {
                        updateSubIndicator(activeSubLink);
                    }, 0);
                }
                
                // Toggle sub-views
                const subViews = document.querySelectorAll('#support .support-sub-view');
                subViews.forEach(view => {
                    if (view.id === activeSubViewId) {
                        view.classList.add('active');
                    } else {
                        view.classList.remove('active');
                    }
                });
            } else {
                subHeader.classList.remove('visible');
            }
        }

        // Handle community sub-routing
        const commSubHeader = document.getElementById('community-sub-header');
        if (commSubHeader) {
            if (isCommunity) {
                commSubHeader.classList.add('visible');
                
                // Determine active sub-tab and active sub-view
                let activeSubTabId = 'sub-nav-discover';
                let activeSubViewId = 'community-discover';
                
                if (hash === '#community-events') {
                    activeSubTabId = 'sub-nav-events';
                    activeSubViewId = 'community-events';
                } else if (hash === '#community-guidelines') {
                    activeSubTabId = 'sub-nav-guidelines';
                    activeSubViewId = 'community-guidelines';
                }
                
                const activeSubLink = document.getElementById(activeSubTabId);
                if (activeSubLink) {
                    const commSubLinks = commSubHeader.querySelectorAll('.sub-nav-links a');
                    commSubLinks.forEach(item => item.classList.remove('active'));
                    activeSubLink.classList.add('active');
                    setTimeout(() => {
                        updateSubIndicator(activeSubLink);
                    }, 0);
                }
                
                // Toggle sub-views
                const commSubViews = document.querySelectorAll('#community .support-sub-view');
                commSubViews.forEach(view => {
                    if (view.id === activeSubViewId) {
                        view.classList.add('active');
                    } else {
                        view.classList.remove('active');
                    }
                });
            } else {
                commSubHeader.classList.remove('visible');
            }
        }
    }

    // Listen for hash modifications
    window.addEventListener('hashchange', handleHashRouting);

    // Initial page load delay to compute navbar indicator coordinates
    setTimeout(() => {
        handleHashRouting();
    }, 50);

    // ----------------------------------------------------
    // 5. Forge AI Floating Chatbot Interactivity
    // ----------------------------------------------------
    const chatTrigger = document.getElementById('forge-chat-trigger');
    const chatIcon = document.getElementById('forge-chat-icon');
    const chatPanel = document.getElementById('forge-chat-panel');
    const chatClose = document.getElementById('forge-chat-close');
    const chatMessages = document.getElementById('forge-chat-messages');
    const chatForm = document.getElementById('forge-chat-form');
    const chatInput = document.getElementById('forge-chat-input');

    const defaultWelcome = {
        sender: 'bot',
        text: "Hello! I am **Forge AI**, your peer communication assistant. 🤖 How can I help you today? Ask me about **download** options, **support** channels, or our **community**!"
    };

    let messages = [];

    // Formats simple bold text and markdown links into HTML safely
    function formatMessageText(text) {
        let safeText = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        
        safeText = safeText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        safeText = safeText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, href) => {
            const targetAttr = href.startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"';
            return `<a href="${href}"${targetAttr}>${linkText}</a>`;
        });
        
        return safeText;
    }

    function saveChatHistory() {
        sessionStorage.setItem('forge_chat_history', JSON.stringify(messages));
    }

    function renderAllMessages() {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-msg ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`;
            
            const formatted = formatMessageText(msg.text);
            if (msg.sender === 'user') {
                msgDiv.innerHTML = `<div class="msg-bubble">${formatted}</div>`;
            } else {
                msgDiv.innerHTML = `
                    <div class="chat-avatar-mini">🤖</div>
                    <div class="msg-bubble">${formatted}</div>
                `;
            }
            chatMessages.appendChild(msgDiv);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function loadChatHistory() {
        const stored = sessionStorage.getItem('forge_chat_history');
        if (stored) {
            try {
                messages = JSON.parse(stored);
            } catch (e) {
                messages = [];
            }
        }
        
        if (messages.length === 0) {
            messages.push(defaultWelcome);
            saveChatHistory();
        }
        
        renderAllMessages();
    }

    function showTypingIndicator() {
        if (!chatMessages) return;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-msg bot-msg typing';
        typingDiv.id = 'forge-typing-indicator';
        typingDiv.innerHTML = `
            <div class="chat-avatar-mini">🤖</div>
            <div class="msg-bubble">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTypingIndicator() {
        const indicator = document.getElementById('forge-typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function getBotResponse(userInput) {
        const lower = userInput.toLowerCase();
        
        if (lower.includes('download') || lower.includes('install') || lower.includes('windows') || lower.includes('mac') || lower.includes('app')) {
            return "You can get the full ForgeAlly experience by downloading our client for **Windows** or **macOS**. Explore download links and compatibility options in the [Download Section](#download)!";
        }
        
        if (lower.includes('support') || lower.includes('help') || lower.includes('contact') || lower.includes('email') || lower.includes('ticket') || lower.includes('feedback')) {
            return "Need assistance? You can check our Help Center, submit a support request ticket, or share feedback in the [Support Section](#support). For direct inquiries, feel free to email services.forgeally@gmail.com.";
        }
        
        if (lower.includes('community') || lower.includes('discover') || lower.includes('events') || lower.includes('guidelines') || lower.includes('ally') || lower.includes('join')) {
            return "Get connected! In the [Community Section](#community), you can discover public Allys like DevForge or Apex Clan, RSVP to upcoming community events, or review our safety guidelines.";
        }
        
        return "I'm here to help! Feel free to ask about the **download** options, getting **support**, or joining the **community** features of ForgeAlly, or use the navigation indicators above!";
    }

    function handleSendMessage(e) {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        
        messages.push({ sender: 'user', text: text });
        saveChatHistory();
        renderAllMessages();
        
        chatInput.value = '';
        
        showTypingIndicator();
        
        const responseText = getBotResponse(text);
        
        setTimeout(() => {
            hideTypingIndicator();
            messages.push({ sender: 'bot', text: responseText });
            saveChatHistory();
            renderAllMessages();
        }, 1200 + Math.random() * 600);
    }

    if (chatTrigger && chatPanel && chatIcon) {
        chatTrigger.addEventListener('click', () => {
            const isOpen = chatPanel.classList.toggle('open');
            if (isOpen) {
                chatIcon.setAttribute('data-lucide', 'x');
                chatInput.focus();
            } else {
                chatIcon.setAttribute('data-lucide', 'message-square');
            }
            lucide.createIcons();
        });

        if (chatClose) {
            chatClose.addEventListener('click', () => {
                chatPanel.classList.remove('open');
                chatIcon.setAttribute('data-lucide', 'message-square');
                lucide.createIcons();
            });
        }

        if (chatForm && chatInput) {
            chatForm.addEventListener('submit', handleSendMessage);
        }

        // Close chat panel when navigating through internal section links in the chat
        if (chatMessages) {
            chatMessages.addEventListener('click', (e) => {
                const anchor = e.target.closest('a');
                if (anchor && anchor.getAttribute('href').startsWith('#')) {
                    chatPanel.classList.remove('open');
                    chatIcon.setAttribute('data-lucide', 'message-square');
                    lucide.createIcons();
                }
            });
        }

        // Initialize chat history and render
        loadChatHistory();
    }

    // ----------------------------------------------------
    // 6. Feedback Star Rating Interaction
    // ----------------------------------------------------
    const feedbackStars = document.getElementById('feedback-stars');
    if (feedbackStars) {
        feedbackStars.addEventListener('click', (e) => {
            const star = e.target.closest('.star-icon');
            if (!star) return;
            const index = parseInt(star.getAttribute('data-index'));
            const stars = feedbackStars.querySelectorAll('.star-icon');
            stars.forEach((s, idx) => {
                if (idx < index) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });
    }
    // ----------------------------------------------------
    // 7. Login Phone Tabs Toggle
    // ----------------------------------------------------
    const btnPhoneSms = document.getElementById('btn-phone-sms');
    const btnPhoneQr = document.getElementById('btn-phone-qr');
    const phoneSmsView = document.getElementById('phone-sms-view');
    const phoneQrView = document.getElementById('phone-qr-view');

    if (btnPhoneSms && btnPhoneQr && phoneSmsView && phoneQrView) {
        btnPhoneSms.addEventListener('click', () => {
            btnPhoneSms.classList.add('active');
            btnPhoneQr.classList.remove('active');
            phoneSmsView.style.display = 'block';
            phoneQrView.style.display = 'none';
        });

        btnPhoneQr.addEventListener('click', () => {
            btnPhoneQr.classList.add('active');
            btnPhoneSms.classList.remove('active');
            phoneSmsView.style.display = 'none';
            phoneQrView.style.display = 'flex';
        });
    }

    // ----------------------------------------------------
    // 8. Dynamic Phone Number Placeholder by Country Select
    // ----------------------------------------------------
    const countrySelect = document.getElementById('phone-country-code');
    const phoneInput = document.getElementById('login-phone');
    if (countrySelect && phoneInput) {
        countrySelect.addEventListener('change', () => {
            const selectedOption = countrySelect.options[countrySelect.selectedIndex];
            const placeholder = selectedOption.getAttribute('data-placeholder');
            phoneInput.placeholder = placeholder;
            phoneInput.value = ''; // Reset input to let them type fresh in the new format
        });
    }

    // ----------------------------------------------------
    // 9. Home Page Scroll-Driven Animations
    // ----------------------------------------------------
    const homeSection = document.getElementById('home');
    const scrollTextPanel = document.querySelector('.scroll-text-panel');
    const revealText1 = document.getElementById('reveal-text-1');
    const revealText2 = document.getElementById('reveal-text-2');

    function handleHomeScroll() {
        if (!homeSection || !homeSection.classList.contains('active')) return;

        const windowHeight = window.innerHeight;

        // 1. Text reveals panel scroll progress
        if (scrollTextPanel && revealText1 && revealText2) {
            const panelRect = scrollTextPanel.getBoundingClientRect();
            const totalScrollRange = panelRect.height - windowHeight;
            
            if (panelRect.top <= 0 && panelRect.bottom >= 0) {
                const progress = Math.max(0, Math.min(1, -panelRect.top / totalScrollRange));
                
                // Text 1 phase (progress 0.02 to 0.30)
                if (progress >= 0.02) {
                    if (progress < 0.30) {
                        // Fade and slide up: Y from 50px to 0px, opacity from 0 to 1
                        const t1 = (progress - 0.02) / 0.28;
                        revealText1.style.opacity = t1;
                        revealText1.style.transform = `translateY(${50 * (1 - t1)}px)`;
                    } else {
                        // Stops there and never fades out
                        revealText1.style.opacity = 1;
                        revealText1.style.transform = `translateY(0px)`;
                    }
                } else {
                    revealText1.style.opacity = 0;
                    revealText1.style.transform = `translateY(50px)`;
                }

                // Text 2 phase (progress 0.32 to 0.65)
                if (progress >= 0.32) {
                    if (progress < 0.65) {
                        // Fade and slide up below the prior text: Y from 50px to 0px, opacity from 0 to 1
                        const t2 = (progress - 0.32) / 0.33;
                        revealText2.style.opacity = t2;
                        revealText2.style.transform = `translateY(${50 * (1 - t2)}px)`;
                    } else {
                        // Stops there and never fades out
                        revealText2.style.opacity = 1;
                        revealText2.style.transform = `translateY(0px)`;
                    }
                } else {
                    revealText2.style.opacity = 0;
                    revealText2.style.transform = `translateY(50px)`;
                }
            } else if (panelRect.top > 0) {
                // Reset to initial state
                revealText1.style.opacity = 0;
                revealText1.style.transform = `translateY(50px)`;
                revealText2.style.opacity = 0;
                revealText2.style.transform = `translateY(50px)`;
            } else if (panelRect.bottom < 0) {
                // Keep them fully visible at the end of the scroll container
                revealText1.style.opacity = 1;
                revealText1.style.transform = `translateY(0px)`;
                revealText2.style.opacity = 1;
                revealText2.style.transform = `translateY(0px)`;
            }
        }
    }

    // Attach passive scroll listener for high scroll performance
    window.addEventListener('scroll', handleHomeScroll, { passive: true });

    // ----------------------------------------------------
    // 10. Split Download Button Dropdown Toggle & OS Switcher
    // ----------------------------------------------------
    const downloadContainer = document.querySelector('.download-dropdown-container');
    const toggleTrigger = document.getElementById('hero-btn-toggle');
    const dropdownMenu = document.getElementById('download-dropdown-menu');
    const downloadBtn = document.getElementById('hero-btn-download');
    const dropdownOsOption = document.getElementById('dropdown-os-option');
    const activeLogoContainer = document.getElementById('active-os-logo-container');

    // Document click listener to toggle dropdown or close on click outside
    document.addEventListener('click', (e) => {
        if (!downloadContainer || !toggleTrigger || !dropdownMenu) return;

        // If click was inside the toggle trigger, toggle dropdown visibility
        if (toggleTrigger.contains(e.target)) {
            const isOpen = downloadContainer.classList.toggle('open');
            dropdownMenu.classList.toggle('visible', isOpen);
        } else {
            // Click outside closes the dropdown
            downloadContainer.classList.remove('open');
            dropdownMenu.classList.remove('visible');
        }
    });

    // Option click listener to swap active OS and logos
    if (dropdownOsOption && activeLogoContainer && downloadContainer && dropdownMenu) {
        dropdownOsOption.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Avoid double toggling via document listener

            const currentOs = downloadContainer.getAttribute('data-active-os');
            const newOs = currentOs === 'win' ? 'mac' : 'win';
            downloadContainer.setAttribute('data-active-os', newOs);

            // Swap SVG contents
            const tempHtml = activeLogoContainer.innerHTML;
            activeLogoContainer.innerHTML = dropdownOsOption.innerHTML;
            dropdownOsOption.innerHTML = tempHtml;

            // Close dropdown
            downloadContainer.classList.remove('open');
            dropdownMenu.classList.remove('visible');
        });
    }

    // Main download button click listener
    if (downloadBtn && downloadContainer) {
        downloadBtn.addEventListener('click', (e) => {
            const activeOs = downloadContainer.getAttribute('data-active-os');
            if (activeOs === 'win') {
                alert('Windows download coming soon!');
            } else {
                alert('macOS download coming soon!');
            }
        });
    }

    // Dynamic resize handler
    window.addEventListener('resize', () => {
        const activeLink = document.querySelector('.nav-links a.active');
        if (activeLink) {
            updateIndicator(activeLink);
        }
        
        // Find visible sub-headers and update their active links
        const visibleSubHeader = document.querySelector('.support-sub-header.visible, .community-sub-header.visible');
        if (visibleSubHeader) {
            const activeSubLink = visibleSubHeader.querySelector('.sub-nav-links a.active');
            if (activeSubLink) {
                updateSubIndicator(activeSubLink);
            }
        }
    });

    // ----------------------------------------------------
    // 11. Backend API Integration (Auth, Register, SMS OTP)
    // ----------------------------------------------------

    // Reusable Toast Notification System
    function showToast(title, desc, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 'alert-circle';
        const iconColor = type === 'success' ? '#34c759' : '#ff3b30';
        
        toast.innerHTML = `
            <div class="toast-icon" style="color: ${iconColor}; display: flex; align-items: center;">
                <i data-lucide="${icon}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-desc">${desc}</div>
            </div>
        `;
        
        container.appendChild(toast);
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        setTimeout(() => {
            toast.style.animation = 'toast-fade-out 0.25s ease forwards';
            setTimeout(() => {
                toast.remove();
            }, 250);
        }, 4000);
    }

    // Inline field-level error helper
    function showError(elementId, message) {
        const errorEl = document.getElementById(elementId);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }
    
    // Clear all inline error messages
    function clearAllErrors() {
        document.querySelectorAll('.form-error-msg').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    }

    // Toggle Login and Register standard forms
    const linkShowRegister = document.getElementById('link-show-register');
    const linkShowLogin = document.getElementById('link-show-login');
    const loginViewStandard = document.getElementById('login-view-standard');
    const registerViewStandard = document.getElementById('register-view-standard');

    if (linkShowRegister && linkShowLogin && loginViewStandard && registerViewStandard) {
        linkShowRegister.addEventListener('click', (e) => {
            e.preventDefault();
            clearAllErrors();
            loginViewStandard.style.display = 'none';
            registerViewStandard.style.display = 'block';
        });

        linkShowLogin.addEventListener('click', (e) => {
            e.preventDefault();
            clearAllErrors();
            registerViewStandard.style.display = 'none';
            loginViewStandard.style.display = 'block';
        });
    }

    // Standard Password-based Register Integration
    const registerForm = document.getElementById('standard-register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAllErrors();

            const username = document.getElementById('register-username').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            
            const countrySelect = document.getElementById('register-phone-country');
            const phoneInput = document.getElementById('register-phone').value.trim();
            const phone = countrySelect.value + phoneInput.replace(/\D/g, ''); // strip non-numeric

            try {
                const response = await fetch('http://localhost:3000/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password, phone })
                });

                const data = await response.json();

                if (!response.ok) {
                    const errText = data.error || 'Registration failed.';
                    if (errText.toLowerCase().includes('username')) {
                        showError('register-username-error', errText);
                    } else if (errText.toLowerCase().includes('email')) {
                        showError('register-email-error', errText);
                    } else if (errText.toLowerCase().includes('phone')) {
                        showError('register-phone-error', errText);
                    } else {
                        showError('register-phone-error', errText);
                    }
                    showToast('Registration Failed', errText, 'error');
                } else {
                    showToast('Success!', 'Registration successful. You can log in now.');
                    registerForm.reset();
                    // Toggle view back to login
                    registerViewStandard.style.display = 'none';
                    loginViewStandard.style.display = 'block';
                }
            } catch (err) {
                console.error(err);
                showToast('Network Error', 'Could not connect to the backend server.', 'error');
            }
        });
    }

    // Standard Password-based Login Integration
    const loginForm = document.getElementById('standard-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAllErrors();

            const username = document.getElementById('login-user').value.trim();
            const password = document.getElementById('login-pass').value;

            try {
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    const errText = data.error || 'Login failed.';
                    showError('login-pass-error', errText);
                    showToast('Login Failed', errText, 'error');
                } else {
                    localStorage.setItem('forgeally_token', data.token);
                    localStorage.setItem('forgeally_user', JSON.stringify(data.user));
                    showToast('Login Successful', `Welcome back, ${data.user.username}!`);
                    loginForm.reset();
                    updateAuthUI();
                    startGlitterWelcome();
                    setTimeout(() => {
                        navigateToSection('home');
                        window.location.hash = '#home';
                    }, 3800);
                }
            } catch (err) {
                console.error(err);
                showToast('Network Error', 'Could not connect to the backend server.', 'error');
            }
        });
    }


    // ── Phone OTP Login ──────────────────────────────────────────
    (function initPhoneOtpLogin() {
        const btnSendOtp    = document.getElementById('btn-send-otp');
        const btnVerifyOtp  = document.getElementById('btn-verify-otp');
        const btnResendOtp  = document.getElementById('btn-resend-otp');
        const btnChangePhone= document.getElementById('btn-change-phone');
        const stepPhone     = document.getElementById('otp-step-phone');
        const stepVerify    = document.getElementById('otp-step-verify');
        const devBox        = document.getElementById('otp-dev-box');
        const devCode       = document.getElementById('otp-dev-code');
        const phoneDisplay  = document.getElementById('otp-phone-display');
        const digitInputs   = Array.from(document.querySelectorAll('.otp-digit-input'));
        const countdownEl   = document.getElementById('otp-countdown');
        const timerMsg      = document.getElementById('otp-timer-msg');
        const resendBtn     = document.getElementById('btn-resend-otp');

        if (!btnSendOtp) return; // guard — page might not have this section

        let currentPhone = '';
        let countdownTimer = null;

        // ── Digit-input keyboard UX ──────────────────────────────
        digitInputs.forEach((inp, i) => {
            inp.addEventListener('input', (e) => {
                const val = e.target.value.replace(/\D/g, '');
                inp.value = val.slice(-1);
                inp.classList.toggle('filled', inp.value !== '');
                if (val && i < 5) digitInputs[i + 1].focus();
                // Auto-verify if all filled
                if (digitInputs.every(d => d.value)) btnVerifyOtp.click();
            });
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !inp.value && i > 0) {
                    digitInputs[i - 1].focus();
                    digitInputs[i - 1].value = '';
                    digitInputs[i - 1].classList.remove('filled');
                }
            });
            inp.addEventListener('paste', (e) => {
                e.preventDefault();
                const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                if (paste.length >= 6) {
                    digitInputs.forEach((d, idx) => {
                        d.value = paste[idx] || '';
                        d.classList.toggle('filled', !!d.value);
                    });
                    digitInputs[5].focus();
                    if (digitInputs.every(d => d.value)) btnVerifyOtp.click();
                }
            });
        });

        // ── Countdown timer ──────────────────────────────────────
        function startCountdown(seconds = 60) {
            clearInterval(countdownTimer);
            let remaining = seconds;
            countdownEl.textContent = remaining;
            timerMsg.style.display = 'inline';
            resendBtn.style.display = 'none';

            countdownTimer = setInterval(() => {
                remaining--;
                countdownEl.textContent = remaining;
                if (remaining <= 0) {
                    clearInterval(countdownTimer);
                    timerMsg.style.display = 'none';
                    resendBtn.style.display = 'inline';
                }
            }, 1000);
        }

        // ── Helper: set button loading state ────────────────────
        function setLoading(btn, textId, spinnerId, loading) {
            const textEl = document.getElementById(textId);
            const spinEl = document.getElementById(spinnerId);
            btn.disabled = loading;
            if (textEl) textEl.style.opacity = loading ? '0' : '1';
            if (spinEl) spinEl.style.display = loading ? 'inline-block' : 'none';
        }

        // ── Send OTP ─────────────────────────────────────────────
        async function doSendOtp() {
            clearAllErrors();
            const countryCode = document.getElementById('phone-country-code').value;
            const phoneRaw    = document.getElementById('login-phone').value.trim();

            if (!phoneRaw) {
                showError('login-phone-error', 'Please enter your phone number.');
                return;
            }

            currentPhone = countryCode + phoneRaw.replace(/\D/g, '');
            setLoading(btnSendOtp, 'btn-send-otp-text', 'btn-send-otp-spinner', true);

            try {
                const resp = await fetch('http://localhost:3000/api/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone })
                });
                const data = await resp.json();

                if (!resp.ok) {
                    const errText = data.error || 'Failed to send OTP.';
                    showError('login-phone-error', errText);
                    showToast('SMS Error', errText, 'error');
                } else {
                    // Show step 2
                    stepPhone.style.display  = 'none';
                    stepVerify.style.display = 'flex';
                    if (phoneDisplay) phoneDisplay.textContent = currentPhone;

                    if (data.otp) {
                        // ── Dev mode: display OTP and auto-fill ──────────
                        devCode.textContent = data.otp;
                        devBox.style.display = 'flex';
                        data.otp.split('').forEach((ch, idx) => {
                            if (digitInputs[idx]) {
                                digitInputs[idx].value = ch;
                                digitInputs[idx].classList.add('filled');
                            }
                        });
                        showToast('Dev Mode', `No SMS service configured. Code: ${data.otp}`, 'success');
                    } else {
                        // ── Real SMS sent: clear inputs, hide dev box ────
                        devBox.style.display = 'none';
                        digitInputs.forEach(d => { d.value = ''; d.classList.remove('filled'); });
                        showToast('📱 OTP Sent!', `A 6-digit code was sent to ${currentPhone}. Enter it below.`, 'success');
                    }

                    startCountdown(60);
                    digitInputs[0].focus();
                }
            } catch (err) {
                console.error(err);
                showToast('Network Error', 'Could not reach the server.', 'error');
            } finally {
                setLoading(btnSendOtp, 'btn-send-otp-text', 'btn-send-otp-spinner', false);
            }
        }

        // ── Verify OTP ───────────────────────────────────────────
        async function doVerifyOtp() {
            clearAllErrors();
            const otp = digitInputs.map(d => d.value).join('');
            if (otp.length < 6) {
                showError('login-otp-error', 'Please enter the complete 6-digit code.');
                return;
            }

            setLoading(btnVerifyOtp, 'btn-verify-otp-text', 'btn-verify-otp-spinner', true);

            try {
                const resp = await fetch('http://localhost:3000/api/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: currentPhone, otp })
                });
                const data = await resp.json();

                if (!resp.ok) {
                    const errText = data.error || 'OTP verification failed.';
                    showError('login-otp-error', errText);
                    showToast('Verification Failed', errText, 'error');
                    // Shake digits
                    document.getElementById('otp-digits-row').classList.add('otp-shake');
                    setTimeout(() => document.getElementById('otp-digits-row').classList.remove('otp-shake'), 500);
                } else {
                    localStorage.setItem('forgeally_token', data.token);
                    localStorage.setItem('forgeally_user', JSON.stringify(data.user));
                    clearInterval(countdownTimer);
                    showToast('Phone Verified', 'Welcome to ForgeAlly!', 'success');
                    updateAuthUI();
                    startGlitterWelcome();
                    setTimeout(() => {
                        navigateToSection('home');
                        window.location.hash = '#home';
                    }, 3800);
                }
            } catch (err) {
                console.error(err);
                showToast('Network Error', 'Could not reach the server.', 'error');
            } finally {
                setLoading(btnVerifyOtp, 'btn-verify-otp-text', 'btn-verify-otp-spinner', false);
            }
        }

        // ── Reset to step 1 ──────────────────────────────────────
        function resetPhoneFlow() {
            clearInterval(countdownTimer);
            currentPhone = '';
            stepPhone.style.display  = 'flex';
            stepVerify.style.display = 'none';
            devBox.style.display     = 'none';
            devCode.textContent      = '------';
            digitInputs.forEach(d => { d.value = ''; d.classList.remove('filled'); });
            document.getElementById('login-phone').value = '';
            clearAllErrors();
        }

        // ── Wire events ──────────────────────────────────────────
        btnSendOtp.addEventListener('click', doSendOtp);
        btnVerifyOtp.addEventListener('click', doVerifyOtp);
        if (btnResendOtp) btnResendOtp.addEventListener('click', (e) => { e.preventDefault(); doSendOtp(); });
        if (btnChangePhone) btnChangePhone.addEventListener('click', (e) => { e.preventDefault(); resetPhoneFlow(); });

        // Also allow Enter key on phone input
        const phoneInput = document.getElementById('login-phone');
        if (phoneInput) phoneInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSendOtp(); }});
    })();


    // 12. Persistent Authentication UI and Logout
    function updateAuthUI() {
        const userStr = localStorage.getItem('forgeally_user');
        const navLogin = document.getElementById('nav-login');
        const linkLogout = document.getElementById('link-logout');
        
        if (userStr) {
            try {
                if (navLogin) navLogin.style.display = 'none';
                if (linkLogout) linkLogout.style.display = 'inline-flex';
            } catch (e) {
                console.error(e);
            }
        } else {
            if (navLogin) navLogin.style.display = 'inline-flex';
            if (linkLogout) linkLogout.style.display = 'none';
        }
    }

    // Call updateAuthUI on initialization
    updateAuthUI();

    // Logout Click Event Listener
    const linkLogout = document.getElementById('link-logout');
    if (linkLogout) {
        linkLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('forgeally_token');
            localStorage.removeItem('forgeally_user');
            showToast('Logged Out', 'You have been successfully logged out.');
            updateAuthUI();
            navigateToSection('login');
            window.location.hash = '#login';
        });
    }

    // 13. QR Code Twilio OTP Login Simulation
    const qrView = document.getElementById('phone-qr-view');
    const mockModal = document.getElementById('mobile-mockup-modal');
    const mockOverlay = document.getElementById('mobile-mockup-overlay');
    const btnMockCancel = document.getElementById('btn-phone-mock-cancel');
    const mockLoginForm = document.getElementById('phone-mock-login-form');
    const mockNumberGroup = document.getElementById('phone-mock-number-group');
    const mockOtpGroup = document.getElementById('phone-mock-otp-group');
    const btnMockSubmit = document.getElementById('btn-phone-mock-submit');
    const mockPhoneInput = document.getElementById('phone-mock-number');
    const mockOtpInput = document.getElementById('phone-mock-otp');
    
    let isMockOtpSent = false;
    let mockPhoneVal = '';

    if (qrView && mockModal && mockOverlay && btnMockCancel) {
        // Open mock mobile on QR Click
        qrView.addEventListener('click', () => {
            mockModal.style.display = 'flex';
            resetMockPhoneForm();
        });

        // Close mock mobile
        mockOverlay.addEventListener('click', () => {
            mockModal.style.display = 'none';
        });
        btnMockCancel.addEventListener('click', () => {
            mockModal.style.display = 'none';
        });

        function resetMockPhoneForm() {
            isMockOtpSent = false;
            mockPhoneVal = '';
            if (mockOtpGroup) mockOtpGroup.style.display = 'none';
            if (mockNumberGroup) mockNumberGroup.style.display = 'block';
            if (mockPhoneInput) {
                mockPhoneInput.value = '';
                mockPhoneInput.disabled = false;
            }
            if (mockOtpInput) {
                mockOtpInput.value = '';
                mockOtpInput.removeAttribute('required');
            }
            if (btnMockSubmit) {
                btnMockSubmit.textContent = 'Send Code';
                btnMockSubmit.className = 'btn-primary phone-btn';
            }
            clearMockErrors();
        }

        function clearMockErrors() {
            const errNum = document.getElementById('phone-mock-number-error');
            const errOtp = document.getElementById('phone-mock-otp-error');
            if (errNum) { errNum.textContent = ''; errNum.style.display = 'none'; }
            if (errOtp) { errOtp.textContent = ''; errOtp.style.display = 'none'; }
        }

        function showMockError(elementId, msg) {
            const errEl = document.getElementById(elementId);
            if (errEl) {
                errEl.textContent = msg;
                errEl.style.display = 'block';
            }
        }

        // Handle Form Submit
        if (mockLoginForm) {
            mockLoginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                clearMockErrors();

                if (!isMockOtpSent) {
                    // Phase 1: Send OTP via Twilio
                    const phoneRaw = mockPhoneInput.value.trim();
                    mockPhoneVal = '+91' + phoneRaw.replace(/\D/g, ''); // standard IN prefix

                    try {
                        const response = await fetch('http://localhost:3000/api/send-otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: mockPhoneVal })
                        });

                        const data = await response.json();

                        if (!response.ok) {
                            const errText = data.error || 'Failed to send OTP.';
                            showMockError('phone-mock-number-error', errText);
                            showToast('SMS Error', errText, 'error');
                        } else {
                            if (data.otp) {
                                showToast('OTP Sent (Dev Mode)', `Your verification code is: ${data.otp}`, 'success');
                                if (mockOtpInput) mockOtpInput.value = data.otp;
                            } else {
                                showToast('OTP Sent', 'Check your phone or server logs for the 6-digit code.');
                            }
                            isMockOtpSent = true;
                            if (mockOtpGroup) mockOtpGroup.style.display = 'block';
                            if (mockOtpInput) mockOtpInput.setAttribute('required', 'true');
                            if (mockPhoneInput) mockPhoneInput.disabled = true;
                            if (btnMockSubmit) {
                                btnMockSubmit.textContent = 'Approve Login';
                            }
                        }
                    } catch (err) {
                        console.error(err);
                        showToast('Network Error', 'Could not connect to the backend server.', 'error');
                    }
                } else {
                    // Phase 2: Verify OTP and log in on desktop!
                    const otp = mockOtpInput.value.trim();

                    try {
                        const response = await fetch('http://localhost:3000/api/verify-otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: mockPhoneVal, otp })
                        });

                        const data = await response.json();

                        if (!response.ok) {
                            const errText = data.error || 'Invalid or expired OTP.';
                            showMockError('phone-mock-otp-error', errText);
                            showToast('Verification Failed', errText, 'error');
                        } else {
                            localStorage.setItem('forgeally_token', data.token);
                            localStorage.setItem('forgeally_user', JSON.stringify(data.user));
                            showToast('Login Successful', `Welcome back! Mobile verified.`);
                            mockModal.style.display = 'none';
                            updateAuthUI();
                            startGlitterWelcome();
                            setTimeout(() => {
                                navigateToSection('home');
                                window.location.hash = '#home';
                            }, 3800);
                        }
                    } catch (err) {
                        console.error(err);
                        showToast('Network Error', 'Could not connect to the backend server.', 'error');
                    }
                }
            });
        }
    }

    // 14. Glitter Splash Canvas Animation
    let glitterAnimationId = null;
    function startGlitterWelcome() {
        const overlay = document.getElementById('welcome-glitter-overlay');
        const canvas = document.getElementById('glitter-canvas');
        if (!overlay || !canvas) return;

        if (glitterAnimationId) {
            cancelAnimationFrame(glitterAnimationId);
        }

        overlay.style.display = 'flex';
        overlay.style.opacity = '0';
        
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);

        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        window.addEventListener('resize', onResize);
        function onResize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }

        class Particle {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 8;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed - (1 + Math.random() * 3);
                this.gravity = 0.08 + Math.random() * 0.08;
                this.friction = 0.98;
                
                const colors = [
                    '#ff007f', // pink
                    '#0071e3', // blue
                    '#a259ff', // purple
                    '#ffc000', // gold
                    '#ffffff', // white
                    '#00f2fe'  // cyan
                ];
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.size = 2 + Math.random() * 6;
                this.alpha = 1;
                this.decay = 0.01 + Math.random() * 0.015;
                this.rotation = Math.random() * Math.PI;
                this.rotationSpeed = (Math.random() - 0.5) * 0.2;
                this.isStar = Math.random() > 0.4;
            }

            update() {
                this.vx *= this.friction;
                this.vy *= this.friction;
                this.vy += this.gravity;
                this.x += this.vx;
                this.y += this.vy;
                this.alpha -= this.decay;
                this.rotation += this.rotationSpeed;
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation);
                ctx.globalAlpha = this.alpha;
                ctx.fillStyle = this.color;
                ctx.shadowBlur = this.size * 2;
                ctx.shadowColor = this.color;

                if (this.isStar) {
                    ctx.beginPath();
                    for (let i = 0; i < 4; i++) {
                        ctx.lineTo(0, -this.size * 1.5);
                        ctx.rotate(Math.PI / 2);
                        ctx.lineTo(0, -this.size / 4);
                        ctx.rotate(Math.PI / 2);
                    }
                    ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        const particles = [];
        const centerX = width / 2;
        const centerY = height / 2;
        for (let i = 0; i < 200; i++) {
            particles.push(new Particle(centerX, centerY));
        }

        let spawnTimer = 0;

        function animate() {
            ctx.clearRect(0, 0, width, height);

            spawnTimer++;
            if (spawnTimer % 2 === 0 && particles.length < 300) {
                for (let i = 0; i < 3; i++) {
                    particles.push(new Particle(centerX, centerY));
                }
            }

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.update();
                p.draw();
                if (p.alpha <= 0 || p.y > height) {
                    particles.splice(i, 1);
                }
            }

            glitterAnimationId = requestAnimationFrame(animate);
        }

        animate();

        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                cancelAnimationFrame(glitterAnimationId);
                glitterAnimationId = null;
                window.removeEventListener('resize', onResize);
            }, 500);
        }, 4000);
    }
});

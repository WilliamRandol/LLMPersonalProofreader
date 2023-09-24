window.addEventListener('load', async () => {
    let waitingForResponse = false;
    const apiUrl = 'https://api.openai.com/v1/';
    const url = `${apiUrl}chat/completions`;
    const modelsUrl = `${apiUrl}models`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': '',
    };
    const message = {
        messages: [
            {
                role: 'system',
                content: 'You are a professional proofreader. Your response should always be a json file with the following information: {"content": A repeat of the message as close to the original content as possible with all spelling, grammar, and punctuation errors fixed., "fixes": An explanation of the changes you made.}',
            }
        ]
    }

    initInput();
    initTabs();
    initCopyToClipboard();

    await setApiKey();
    await selectModel();

    function initInput() {
        document.querySelectorAll('.content-form').forEach(f => f.addEventListener('submit', submitMessage));

        async function submitMessage(e) {
            e.preventDefault();
            e.stopPropagation();

            if (waitingForResponse) return;

            const prompt = preparePrompt();
            const responseData = await fetchResponse(prompt);
            writeResponse(responseData.choices[0].message.content);

            function preparePrompt() {
                const userMessage = e.target.querySelector('.content').value;
                const newPrompt = structuredClone(message);
                newPrompt.messages.push({
                    role: 'user',
                    content: userMessage,
                });

                return newPrompt;
            }

            async function fetchResponse(prompt) {
                toggleWaiting();

                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(prompt)
                });

                const data = await response.json();

                toggleWaiting();

                return data;
            }

            function writeResponse(response) {
                document.getElementById('raw').innerHTML = '';
                try {
                    const resultData = JSON.parse(response);
                    const responseTextarea = document.getElementById('results');
                    responseTextarea.value = resultData.content;

                    writeFixes(resultData.fixes);

                    navigator.clipboard.writeText(resultData.content);
                } catch (e) {
                    document.getElementById('raw').innerHTML = response;
                }

                function writeFixes(fixes) {
                    const fixesElement = document.getElementById('fixes');

                    fixesElement.innerHTML = deserializeFix(fixes);

                    function deserializeFix(fixes) {
                        if (typeof fixes === 'string') {
                            return fixes;
                        }

                        if (Array.isArray(fixes)) {
                            return `<ul><li>${fixes.map(f => deserializeFix(f)).join('</li></ul>')}</li></ul>`;
                        }

                        if (typeof fixes === 'object') {
                            return `<ul><li>${Object.keys(fixes).map(key => `${key}: ${deserializeFix(fixes[key])}`).join('</li><li>')}</li></ul>`;
                        }
                    }
                }
            }


        }
    }

    function initTabs() {
        const tabs = document.querySelector('.tabs').querySelectorAll('a');
        tabs.forEach(t => t.addEventListener('click', switchTab));

        function switchTab(e) {
            e.preventDefault();
            e.stopPropagation();

            const tab = e.target;
            const tabId = tab.getAttribute('href').replace('#', '');
            const tabContent = document.getElementById(tabId);

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabContents = tabContent.parentElement.querySelectorAll('.tab-content');
            tabContents.forEach(t => t.classList.remove('active'));
            tabContent.classList.add('active');
        }
    }

    function initCopyToClipboard() {
        document.getElementById('copy').addEventListener('click', copyToClipboard);
    }

    async function setApiKey() {
        const apiKey = localStorage.getItem('LLMPPOpenAIApiKey') ?? await promptForApiKey();
        headers.Authorization = `Bearer ${apiKey}`;

        function promptForApiKey() {

            return new Promise((resolve, reject) => {
                const dialog = document.createElement('dialog');
                dialog.id = 'api-key-dialog';

                const form = document.createElement('form');
                form.id = 'api-key-form';

                const header = document.createElement('h1');
                header.innerText = 'Add your OpenAI API Key';

                const label = document.createElement('label');
                label.innerText = 'API Key';
                label.for = 'api-key-input';

                const input = document.createElement('input');
                input.id = 'api-key-input';

                const submit = document.createElement('button');
                submit.id = 'api-key-submit';
                submit.innerText = 'Save';

                form.appendChild(header);
                form.appendChild(label);
                form.appendChild(input);
                form.appendChild(submit);
                dialog.appendChild(form);
                document.body.appendChild(dialog);

                dialog.showModal();

                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    localStorage.setItem('LLMPPOpenAIApiKey', input.value);

                    dialog.close();

                    document.body.removeChild(dialog);

                    resolve(input.value);

                });
            });
        }
    }

    async function selectModel() {
        toggleWaiting();
        const modelsResponse = await fetch(modelsUrl, { headers });
        const models = await modelsResponse.json();
        toggleWaiting();

        message.model = models.data.some(m => m.id === 'gpt-4') ? 'gpt-4' : 'gpt-3.5-turbo';
        document.querySelector('footer').innerHTML = `Using Model: ${message.model}.`;
    }

    function copyToClipboard() {
        const responseTextarea = document.getElementById('results');
        navigator.clipboard.writeText(responseTextarea.value);
    }

    function toggleWaiting() {
        const spinner = document.getElementById('spinner-dialog');
        const submits = document.querySelectorAll('input[type="submit"]')

        if (spinner.hasAttribute('open')) {
            spinner.classList.add('hide');
            spinner.addEventListener('animationend', function hideSpinner(e) {
                if (e.animationName == 'hide-spinner') {
                    spinner.close();
                    spinner.classList.remove('hide');
                    spinner.removeEventListener('animationend', hideSpinner);
                }
            });
            submits.forEach(s => s.disabled = false);
            waitingForResponse = false;
            return;
        }
        spinner.show();
        submits.forEach(s => s.disabled = true);
        waitingForResponse = true;
    };
});

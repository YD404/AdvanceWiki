document.addEventListener('DOMContentLoaded', () => {
    // 3.1. Library Initialization
    lucide.createIcons();

    // 3.2. Accordion Functionality
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            // Toggle content visibility
            const content = header.nextElementSibling;
            if (content && content.classList.contains('accordion-content')) {
                content.classList.toggle('hidden');
            }

            // Rotate Icon
            const icon = header.querySelector('.toggle-icon');
            if (icon) {
                icon.classList.toggle('rotate-180'); // Tailwind util for rotation
                // If not using tailwind for this specific part, ensure CSS handles it, 
                // but spec mentions 'rotate-180 class' so assuming Tailwind or utility class exists.
                // Adding fallback style if class isn't sufficient in style.css, but assuming tailwind is loaded.
                if (!icon.classList.contains('rotate-180')) {
                   icon.style.transform = 'rotate(0deg)';
                } else {
                   icon.style.transform = 'rotate(180deg)';
                }
            }
        });
    });

    // 3.3. Clipboard Copy Functionality
    const copyButtons = document.querySelectorAll('.copy-button');
    copyButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const container = button.closest('.code-container');
            const codeElement = container.querySelector('code');
            
            if (codeElement) {
                const text = codeElement.innerText;
                
                try {
                    await navigator.clipboard.writeText(text);
                    
                    // Success Feedback
                    const originalIcon = button.innerHTML;
                    // Change to check icon
                    button.innerHTML = '<i data-lucide="check"></i>';
                    lucide.createIcons(); // Re-render the new icon

                    setTimeout(() => {
                        button.innerHTML = '<i data-lucide="copy"></i>'; // Revert to copy icon
                        lucide.createIcons();
                    }, 2000);

                } catch (err) {
                    console.error('Failed to copy text: ', err);
                }
            }
        });
    });
});

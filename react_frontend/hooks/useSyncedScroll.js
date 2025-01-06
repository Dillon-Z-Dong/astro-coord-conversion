export function useSyncedScroll() {
    const handleInputScroll = (e) => {
      const outputPanel = document.querySelector('.output-scroll');
      if (outputPanel) {
        outputPanel.scrollTop = e.target.scrollTop;
      }
    };
  
    const handleOutputScroll = (e) => {
      const textarea = document.querySelector('textarea');
      const inputLineNumbers = textarea?.previousSibling;
      const outputLineNumbers = e.target.previousSibling;
      
      if (textarea) textarea.scrollTop = e.target.scrollTop;
      if (inputLineNumbers) inputLineNumbers.scrollTop = e.target.scrollTop;
      if (outputLineNumbers) outputLineNumbers.scrollTop = e.target.scrollTop;
    };
  
    return {
      handleInputScroll,
      handleOutputScroll
    };
  }
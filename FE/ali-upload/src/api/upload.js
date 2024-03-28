const uploadUrl = 'http://127.0.0.1:3000/upload/single';

export function upload(file, onProgress, onFinish) {
  const xhr = new XMLHttpRequest();
  xhr.onload = function () {
    const resp = JSON.parse(xhr.responseText);
    onFinish(resp);
  };
  xhr.upload.onprogress = (e) => {
    const percent = Math.floor((e.loaded / e.total) * 100);
    onProgress(percent);
  };
  xhr.open('POST', uploadUrl);
  const form = new FormData();
  form.append('file', file);
  xhr.send(form);
  return function () {
    xhr.abort();
  };
}

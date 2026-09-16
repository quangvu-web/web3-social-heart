FROM tiangolo/nginx-rtmp:latest

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY nginx.conf /etc/nginx/nginx.conf
COPY cleanup-hls.sh /usr/local/bin/cleanup-hls.sh

RUN chmod +x /usr/local/bin/cleanup-hls.sh \
  && mkdir -p /var/www/hls/live

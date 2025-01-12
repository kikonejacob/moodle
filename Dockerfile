# Docker-Moodle
# Dockerfile for moodle instance. more dockerish version of https://github.com/sergiogomez/docker-moodle
# Forked from Jade Auer's docker version. https://github.com/jda/docker-moodle
FROM ubuntu:22.04
LABEL maintainer="Jonathan Hardison <jmh@jonathanhardison.com>"


EXPOSE 80 443
COPY docker/moodle-config.php /var/www/html/config.php
WORKDIR /var/www/html

# Let the container know that there is no tty
ENV DEBIAN_FRONTEND noninteractive

# Database info and other connection information derrived from env variables. See readme.
# Set ENV Variables externally Moodle_URL should be overridden.
ENV MOODLE_URL http://127.0.0.1

# Enable when using external SSL reverse proxy
# Default: false
ENV SSL_PROXY false

COPY ./docker/foreground.sh /etc/apache2/foreground.sh

COPY docker/docker-php-max_input_vars.ini /usr/local/etc/php/conf.d/max_input_vars.ini
COPY docker/docker-php-max_input_vars.ini /etc/php/8.1/apache2/php.ini

RUN apt-get update && apt-get upgrade -y && \
	apt-get -y install mysql-client pwgen python-setuptools curl git unzip apache2 php \
		php-gd libapache2-mod-php postfix wget supervisor php-pgsql curl libcurl4 \
		libcurl3-dev php-curl php-xmlrpc php-intl php-mysql git-core php-xml php-mbstring php-zip php-soap cron php-ldap && \
	cd /tmp && \
	chown -R www-data:www-data /var/www/html && \
	chmod +x /etc/apache2/foreground.sh

#cron
COPY docker/moodlecron /etc/cron.d/moodlecron

RUN chmod 0644 /etc/cron.d/moodlecron

# Enable SSL, moodle requires it
RUN a2enmod ssl && a2ensite default-ssl  #if using proxy dont need actually secure connection

# Cleanup, this is ran to reduce the resulting size of the image.
RUN apt-get clean autoclean && apt-get autoremove -y && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /var/lib/dpkg/* /var/lib/cache/* /var/lib/log/*

ENTRYPOINT ["/etc/apache2/foreground.sh"]
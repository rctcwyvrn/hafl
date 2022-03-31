FROM python:3.10

# shellphish_qemu and shellphish_afl
RUN git clone https://github.com/angr/wheels.git\
    && pip3 install wheels/shellphish*.whl

# driller
RUN git clone https://github.com/shellphish/driller.git \
    && pip3 install -r driller/requirements.txt \
    && pip3 install -e driller 

# set entrypoint
COPY "./drill.py" "/drill.py"
ENTRYPOINT [ "/drill.py" ]
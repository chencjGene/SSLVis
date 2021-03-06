import paramiko
import shutil
from scp import SCPClient
import local_config
import os
# * 1. If you have no ssh private key, use "ssh-keygen -p -m PEM -f ~/.ssh/id_rsa" to generate.
#       No passphrase for convenience!
#       If you already have ssh private key, skip this step otherwise your old key will be replaced.
# * 2. Use "ssh-copy-id yourusername@server" to send your public key to server.
# * 3. config user, ip and remote_path in this file. Note: default local path is 'SSLVis/application/data'
ssh = paramiko.SSHClient()
user = local_config.user
ip = local_config.server
remote_path = local_config.remote_path
local_path = local_config.local_path
ssh.load_system_host_keys()
ssh.connect(hostname=ip, username=user)

def download():
    if not os.path.exists(os.path.join(local_config.local_path, 'data')):
        os.makedirs(os.path.join(local_config.local_path, 'data'))
    with SCPClient(ssh.get_transport()) as scp:
        shutil.rmtree(path=local_path+'./data')
        scp.get(local_path=local_path, recursive=True, remote_path=remote_path+'data')

if __name__ == "__main__":
# upload or download
	download()

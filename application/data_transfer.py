import paramiko
import shutil
from scp import SCPClient
# * 1. If you have no ssh private key, use "ssh-keygen -p -m PEM -f ~/.ssh/id_rsa" to generate.
#       No passphrase for convenience!
#       If you already have ssh private key, skip this step otherwise your old key will be replaced.
# * 2. Use "ssh-copy-id yourusername@server" to send your public key to server.
# * 3. config user, ip and remote_path in this file. Note: default local path is './data
ssh = paramiko.SSHClient()
user = 'zhaowei'
ip = '166.111.80.25'
remote_path = '/home/zhaowei/'
ssh.load_system_host_keys()
ssh.connect(hostname=ip, username='zhaowei')
def upload():
    with SCPClient(ssh.get_transport()) as scp:
        ssh.exec_command('rm -r '+remote_path+'data')
        scp.put('data', recursive=True, remote_path=remote_path)

def download():
    with SCPClient(ssh.get_transport()) as scp:
        shutil.rmtree(path='./data')
        scp.get(local_path='./', recursive=True, remote_path=remote_path+'data')

# upload or download
upload()
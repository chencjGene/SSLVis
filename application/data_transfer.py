import paramiko
import shutil
from scp import SCPClient

ssh = paramiko.SSHClient()
user = 'zhaowei'
ip = '166.111.80.25'
remote_path = '/home/zhaowei/'
ssh.load_system_host_keys()
ssh.connect(hostname=ip, username='zhaowei', password='123456')
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
Created by 瞿蓝孟, last modified on 五月 23, 2023

##   [1. Overview（概述）](#1-overview概述)  

追平单机和分布式的配置项查看与修改参数的命令

##   [2. Features（功能特性）](#2-features功能特性)  

- ycs配置参数展示
- yfs配置参数展示


##   [3. Interfaces（接口）](#3-interfaces接口)  

ycs/yfs config show

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. 目前共享集群不太稳定，所有配置项都是写死的，随意修改YCS/YFS配置项可能会引起错误；
1. 共享集群修改配置项后需要重启，且当前节点级别启停会引发问题；
1. 故暂时不支持YCS/YFS的配置项修改； 待共享集群稳定后，再提供配置参数修改功能；


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 配置展示命令](#51-配置展示命令)  

```
[jenkins@localhost work]$ ./bin/yasboot yfs config  show -c tt --node-id 1-1
nodeid="1-1"
 parameters    | current_value                       
-----------------------------------------------------
 RECY_INTERVAL | 86400                               
---------------+-------------------------------------
 PACKET_SIZE   | 2K                                  
---------------+-------------------------------------
 LOG_LEVEL     | DEBUG                               
---------------+-------------------------------------
 BOOT_DISK     | SIMS:/DEV2                          
---------------+-------------------------------------
 SYS_AREA_SIZE | 256M                                
---------------+-------------------------------------


```

```
[jenkins@localhost work]$ ./bin/yasboot ycs config  show -c tt --node-id 1-1
nodeid="1-1"
 parameters  | current_value                       
---------------------------------------------------
 VOTING_DISK | SIMS:/DEV1|16M|4K                   
-------------+-------------------------------------
 INTER_URL   | 192.168.4.110:1788                  
-------------+-------------------------------------
 NODE_ID     | 0                                   
-------------+-------------------------------------
 LOG_LEVEL   | DEBUG                               
-------------+-------------------------------------
 RESOURCE1   | /var/lib/jenkins/workspace/yashandb 
             | /23.1.0.2/lib/libyasfs.so           
-------------+-------------------------------------



```

###   [5.2 配置文件](#52-配置文件)  

####   [5.2.1 集群架构需要的配置文件](#521-集群架构需要的配置文件)  

yasfs.ini

```
BOOT_DISK=SIMS:/DEV2
SYS_AREA_SIZE=256M
RECY_INTERVAL=86400
PACKET_SIZE=2K
LOG_LEVEL=DEBUG

```

yascs.ini

```
VOTING_DISK=SIMS:/DEV1|16M|4K
INTER_URL=127.0.0.1:1770
NODE_ID=0
LOG_LEVEL=DEBUG
RESOURCE1=/var/lib/jenkins/rac/lib/libyasfs.so
RESOURCE2="start=/var/lib/jenkins/workspace/yashandb/data/tt/node0/start_instance0.sh;stop=/var/lib/jenkins/workspace/yashandb/data/tt/node0/stop_instance0.sh"

```

node0目录下config/yasdb.ini

```
CONTROL_FILES=('+DG0/ctrlfile0','+DG0/ctrlfile1','+DG0/ctrlfile2')
LISTEN_ADDR=127.0.0.1:1688
DATA_BUFFER_SIZE=128M
CLUSTER_DATABASE=TRUE
RECYCLEBIN_ENABLED=OFF
CLUSTER_INTERCONNECT=127.0.0.1:1700
CLUSTER_SERVICE = UDS//var/lib/jenkins/workspace/yashandb/data/tt/node0/yascs.ipc
CHECKPOINT_INTERVAL=100000
CHECKPOINT_TIMEOUT=300
ARCHIVE_LOCAL_DEST='+arch_files'

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*
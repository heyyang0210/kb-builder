Created by 瞿蓝孟 on 七月 11, 2023

##   [1. Overview（概述）](#1-overview概述)  

yashandb目前有单机、分布式、集群三种架构，目前om已支持单机和分布式架构的部署，现按照单机和分布式的部署的基本流程，实现集群架构的部署

参考YCS部署文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=100089459](https://conf.yasdb.com/pages/viewpage.action?pageId=100089459)  

##   [2. Features（功能特性）](#2-features功能特性)  

- 支持yashandb集群架构的部署
- 支持启停集群架构的yashandb
- 支持卸载集群架构的yashandb


##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- yashandb已经部署起来切是无业务状态
- 各节点机器需要停止monitor


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 部署流程设计](#51-部署流程设计)  

总体流程还是沿用之前的部署流程

- 生成配置文件
- 主机部署：
    - 软件包拷贝、解压、安装
    - 拉起yasom
    - 拉起yasagent
    - 生成yasboot配置
- 初始化yasdb (通过rpc)
    - 启动ycs
    - 启动yfs
    - 启动yasdb


###   [5.2 配置文件](#52-配置文件)  

####   [5.2.1 集群架构需要的配置文件](#521-集群架构需要的配置文件)  

sims.ini(模拟磁阵)

```
DEV1 = /var/lib/jenkins/rac/bin/sims/data/1.dat|100M
DEV2 = /var/lib/jenkins/rac/bin/sims/data/2.dat|4G
DEV3 = /var/lib/jenkins/rac/bin/sims/data/3.dat|100M

```

ycsctl.inl(每个节点都有)

```
exe = var/lib/jenkins/rac/bin/yascs
home = /var/lib/jenkins/rac/data/node0

```

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

启动脚本start_instance0.sh

```
#! /bin/bash

/var/lib/jenkins/rac/bin/yasdb nomount -D /var/lib/jenkins/workspace/yashandb/DATA/tt/data/node0 &amp;

```

停止脚本

```
#! /bin/bash

/var/lib/jenkins/rac/bin/yasql sys/Cod-2022@127.0.0.1:1688 -c "shutdown immediate"

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

####   [5.2.2 om生成配置文件](#522-om生成配置文件)  

```
./bin/yasboot package config gen --host jenkins:123456@192.168.4.110:22:/opt/yasom --cluster tt --yas-type CE --node 3

```

--yas-type新增CE（集群）类型

新增--node参数，控制节点数量

集群.toml（大体与之前一致，只是额外增加的集群架构特有的配置项）

```
cluster = "tt"
create_simple_schema = false
uuid = "6433cc5a7672cd6eb7dc2ec02e57c8c7"

[[group]]
  group_type = "cc"
  name = "ccg1"
  [[group.node]]
    data_path = "/var/lib/jenkins/workspace/yashandb/DATA/tt"
    hostid = "host0001"
    role = 1
    [group.node.config]
      CLUSTER_DATABASE=TRUE
      CLUSTER_INTERCONNECT="192.168.4.110:1700"
      CLUSTER_SERVICE = UDS//var/lib/jenkins/workspace/yashandb/data/tt/node0/yascs.ipc
      LISTEN_ADDR = "192.168.4.110:1688"
      CHECKPOINT_INTERVAL=100000
	  CHECKPOINT_TIMEOUT=300
      ARCHIVE_LOCAL_DEST='+arch_files'

```

###   [5.3 部署](#53-部署)  

1. 执行yfs_sims_srv
1. 格式化裸盘：yfssrv -F -D /var/lib/jenkins/workspace/yashandb/data/tt/node0/
1. 执行yfscmd -D /home/huangyangbo/node0 mkdir DG0，创建DG0目录
1. 执行yfscmd -D /home/huangyangbo/node0 mkdir arch_files，创建arch_files目录
1. 执行yfscmd -D /home/huangyangbo/node0 ls，查看是否已成功创建两个目录
1. 关闭yfssrc(kill -9)
1. 执行ycsctl start ycs，以nomount状态启动node0的ycs+yfs+db
1. 建库
1. 建库语句：
1. 拉起剩下的节点


```
create cluster database tpcc
instance (
logfile('+DG0/redo1' size 128M BLOCKSIZE 512,
'+DG0/redo2' size 128M BLOCKSIZE 512,
'+DG0/redo3' size 128M BLOCKSIZE 512,
'+DG0/redo4' size 128M BLOCKSIZE 512,
'+DG0/redo5' size 128M BLOCKSIZE 512,
'+DG0/redo6' size 128M BLOCKSIZE 512,
'+DG0/redo7' size 128M BLOCKSIZE 512,
'+DG0/redo8' size 128M BLOCKSIZE 512,
'+DG0/redo9' size 128M BLOCKSIZE 512,
'+DG0/redo10' size 128M BLOCKSIZE 512)
UNDO TABLESPACE DATAFILE '+DG0/undo1' size 128M autoextend off)
instance (
logfile('+DG0/redo11' size 128M BLOCKSIZE 512,
'+DG0/redo12' size 128M BLOCKSIZE 512,
'+DG0/redo13' size 128M BLOCKSIZE 512)
UNDO TABLESPACE DATAFILE '+DG0/undo2' size 128M autoextend off)
instance (
logfile('+DG0/redo14' size 128M BLOCKSIZE 512,
'+DG0/redo15' size 128M BLOCKSIZE 512,
'+DG0/redo16' size 128M BLOCKSIZE 512)
UNDO TABLESPACE DATAFILE '+DG0/undo3' size 128M autoextend off)
SWAP TABLESPACE TEMPFILE '+DG0/swap' size 128M autoextend off
DEFAULT TABLESPACE DATAFILE '+DG0/users' size 128M autoextend off
SYSTEM TABLESPACE DATAFILE '+DG0/system' size 128M autoextend off
SYSAUX TABLESPACE DATAFILE '+DG0/sysaux' size 128M autoextend off
TEMPORARY TABLESPACE TEMPFILE '+DG0/temp' size 128M autoextend off;

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

##   [7. Document（资料）](#7-document资料)  

- 1.运维手册-安装部署-YashanDB产品安装-OM安装，增加共享集群安装标题，内容为安装和卸载步骤，其中模拟器不对外，yashandb只提供针对共享磁阵的安装指导
- 2.运维手册-安装部署-安装后初始环境信息，补充共享集群特殊的信息


##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*
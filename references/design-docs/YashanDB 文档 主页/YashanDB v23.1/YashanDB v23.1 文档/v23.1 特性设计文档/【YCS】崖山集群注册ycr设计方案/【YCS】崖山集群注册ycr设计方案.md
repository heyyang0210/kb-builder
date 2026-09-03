Created by 李垠, last modified on 十一月 08, 2024

#   [YDBRD-13483 : 崖山集群注册ycr方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-12150](https://jira.yasdb.com/browse/YDBRD-12150)     / SR链接：    [https://jira.yasdb.com/browse/YDBRD-13483](https://jira.yasdb.com/browse/YDBRD-13483)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

ycr功能，就是将ycs的每个节点的配置信息的公共部分提取出来，统一放到共享磁盘上去配置和管理。这些配置信息，包括集群名称，节点名称，ycs通信地址、ycs管理的资源等等，是构建ycs集群的重要信息。

把这些信息统一放到ycr管理，在未来可以提供以下功能：

- 安装部署进行配置参数有效性的检测
- 动态增加删除节点
- 动态增加删除资源
- 动态修改Topo配置


友商的集群软件，已经实现同样的功能，比如oracle rac 的OCR和DM的DCR，调研报告如下：

  [竞品分析 - 李垠 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104226819)  

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

- ycs集群参数配置功能，包括创建集群、  ~~增加yasfs资源、增加yasdb资源~~  ，增加节点、增加yasdb实例、增加ycs互联地址
- ycs集群配置参数展示功能


  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

- ycsctl create cluster clustername [-o]


                --创建集群，clustername 是集群名称，-o参数表示覆盖原来的集群，不加的话不覆盖原来的集群，会提示错误

- ycsctl add yasdbinstance nodename.instancename   startshell stopshell monitorshell


              --创建yasdb实例资源，支持在一个nodename下面创建多个instancename  （但是yasdb暂不支持，所以单节点多实例场景还只是个预留接口），执行这条命令将会创建一个yasdb资源

              --需要先执行ycsctl add node，再执行这条命令，否则报错

 说明：

1. 监控脚本monitorshell是预留接口，没有实现真正的监控功能
1. 所有实例的三个脚本名称要求一致
1. 三个脚本放在YASCS_HOME 路径下


- ycsctl add node nodename yascs_url


                --为集群增加节点，nodename 是节点名称，yascs_url ：ycs的地址

- ycsctl show config


               --展示集群topo的配置

举例说明：

sudo setcap cap_sys_rawio=eip /home/yasdb/anchorbase/yasdb_home/bin//ycsctl    
  export YASCS_HOME=/home/yasdb/anchorbase/YASDB_NODE/node0    
  ycsctl create cluster yascluster -o    
  ycsctl add node yas1 127.0.0.1:1770    
  ycsctl add node yas2 127.0.0.1:1771    
  ycsctl add yasdbinstance yas1.yasdb start_instance0.sh stop_instance0.sh monitor_instance0.sh    
  ycsctl add yasdbinstance yas2.yasdb start_instance0.sh stop_instance0.sh monitor_instance0.sh

展示集群Topo配置 ycsctl show config

![](https://pingcode.yasdb.com/atlas/files/public/67396b14a1ad9a3311dc7fc7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- ycr盘的大小为1324K
- ycr最多支持64个节点
- ycr支持yasdb一种资源
- 所有名称类配置参数nodename、instancename、clustername 长度必须在4~64之间，以字母开头，支持字母、数字以及下划线_
- ycs内部通信地址yascs_url 的约束是：有效IP地址+冒号+端口号，中间不能有空格，例如：192.168.1.1:1234
- 对于脚本名字的约束是，长度必须在4~64之间，以字母开头，支持字母、数字以及下划线_，必须有扩展名，目前可配置的脚本类型有：sh|pl|py|bat|go|rb|sql，只支持sh，其他只做预留，例如：start_1.sh
- 支持创建集群
- 支持覆盖原有集群
- 支持默认yasfs资源，不需要手工添加
- ~~支持yasdb资源，并且支持一个node对应多个yasdb实例~~
- 支持单机多实例场景
- 支持多机多实例场景
- 支持增加节点和ycs互联地址
- 支持查看公共Topo配置
- 不支持查看每个节点的本地配置
- 单机多实例场景下，必须在yascs.ini中配置隐藏参数 _HOSTNAME，多机器场景可不配置
- ycsctl.ini 文件删除
- 节点本地配置文件yascs.ini保留以下配置参数(注意VOTING_DISK和YCR_DISK的最后一段|4K是废弃字段，本次交付将这个字段删除）：


VOTING_DISK=    [SIMS:/DEV1|16M](http://SIMS/DEV1|16M|4K)      
  YCR_DISK=    [SIMS:/DEV3|16M](http://SIMS/DEV3|16M|4K)      
  _HOSTNAME=yas1    
  LOG_LEVEL=DEBUG    
  AUTO_START=NEVER

说明：隐藏参数 _HOSTNAME，生产场景下，每个服务器运行一个ycs实例，所以ycs与服务器的数量关系是1 : 1，这种场景不需要配置_HOSTNAME，可以通过主机名生成nodeid

          在debug场景下，常见单机多实例的场景，如果不配置 _HOSTNAME，就会存在多个ycs实例对应一个主机名称的情况，这个时候，就必须配置_HOSTNAME，生成虚拟的主机名，用于为每个ycs实例分配nodeid

- 配置文件 /home/yasdb/anchorbase/build/bin/config/sims.ini的变化，ycr需要占用一块盘，sims.ini本身又要求配置的盘的数量比实际使用的盘的数量多一个，所以它的 配置变为下面这个样子（磁阵环境不涉及该问题）


DEV1 = /home/yasdb/anchorbase/build/1.dat|100M   ======voting disk    
  DEV2 = /home/yasdb/anchorbase/build/2.dat|10G      ======data disk    
  DEV3 = /home/yasdb/anchorbase/build/3.dat|100M   ======ycr disk    
  DEV4 = /home/yasdb/anchorbase/build/4.dat|100M   ======多余的盘

- 新增环境变量YASCS_HOME 


原环境变量 YASCM_HOME废弃

YASCS_HOME = /home/yasdb/anchorbase/YASDB_NODE/node0

- ycsctl add yasdbinstance yas1.yasdb start_instance0.sh stop_instance0.sh monitor_instance0.sh命令中的监控脚本monitor_instance0.sh目前只提供配置入口，实际没有使用，脚本可以不存在，代码中也不会校验这个脚本是否存在


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

使用共享磁盘上的一块区域作为ycr disk，用于存储集群配置信息。提供命令行接口，用于集群配置信息的创建和维护。启动集群时，从ycr disk读取配置信息加载到内存，用于控制集群的启动、停止以及监控。

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

ycr功能通过名为ycs_ycr的动态库实现。ycs客户端（ycsctl）和服务器（yascs）都会使用这个动态库提供的API，来完成相应的功能。

![](https://pingcode.yasdb.com/atlas/files/public/67396b14a1ad9a3311dc7fc8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

#### 5.2.1 数据结构

- ycr磁盘结构与数据结构


按照block组织，每个block大小为4K

第一个block存储ycr盘的锁信息，只有前512字节在使用，后面的空闲，对应的数据结构是YcsLockCtrl

第二个block存储集群信息，对应的数据结构是YcsCtrlBlock

第三个block存储资源信息，对应的数据结构是YcsYcrResBlock

后面是64个4K大小的Block，存储节点信息，对应的数据结构是YcsYcrNodeBlock

ycr disk总大小位 4K* 3 + 16K* 2 +4K* 64 +1024K = 1324K，redo区域大小同样为1324K，所以ycr盘总大小至少为  1324K * 2 = 2648K

说明：”预留”空间目前只做预留，分配空间，用于后续扩展使用，本次交付不做数据结构的设计。

ycr redo disk 的布局与ycr disk结构相同，偏移量为 ycrdisk + YCS_YCR_DISK_SIZE

YCS_YCR_DISK_SIZE为ycr盘总大小，redo区域从ycr盘末尾开始向上记录数据如下图所示

![](https://pingcode.yasdb.com/atlas/files/public/67396b14a1ad9a3311dc7fc9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

ycr disk/ycr redo   disk布局

![](https://pingcode.yasdb.com/atlas/files/public/67396b14a1ad9a3311dc7fca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

  


|数据结构名称|数据结构类型|数据结构成员|成员功能描述|
|:---:|:---:|:---:|:---:|
|YcsCtrlBlock|union|YcsYcrClu ctrl,CodChar   data[YCS_BLOCK_SIZE];|集群控制结构的具体内容,集群控制结构的缓冲区，用于缓存从ycr盘中读取的数据|
|YcsYcrClu |struct|CodUint32 checkSum;,CodBool   isActiveBackup;,CodUint64 magicNumber;  ,CodChar   clusterName[COD_MAX_NAME_LEN];  ,CodUint64 version;                        ,CodUint32 nodeHWM;                      ,CodUint64 nodeMap;      |保存CRC值，用于数据完整性校验,此字段只在临时ycr disk有效，为true，表示redo disk有效，数据还未写入ycr disk，为fase时表示ycr disk 区域写入成功，不需要执行恢复,用于校验磁盘是否存在错误的一串固定的16进制数,集群名称，整个集群只有一个名称,配置版本，集群出创建后，每执行一条配置命令，这个版本都会++，用以判断各个节点是否处于相同的配置中,high water max 高水位，即待分配的最大的nodeid,64位位图，表达了集群64个节点的online、offline状态|
|YcsYcrResBlock|union|YcsYcrRes ctrl;  ,CodChar   data[YCS_BLOCK_SIZE];   | 控制结构,集群控制结构的缓冲区，用于缓存从ycr盘中读取的数据|
|YcsYcrRes|struct|CodUint32 checkSum;,CodBool   enableYFS; ,CodBool   enableFloatIP;  ,CodBool   enableYasDB;  ,CodUint8  unused;  ,CodChar   floatIp[YCS_MAX_NODES][COD_MAX_IPV6_STR_LEN];  ,~~CodChar   dbStartShell[COD_FILENAME_BUFFER_SIZE];   ~~,~~CodChar   dbStopShell[COD_FILENAME_BUFFER_SIZE];    ~~,~~CodChar   dbMonitorShell[COD_FILENAME_BUFFER_SIZE];  ~~,~~CodChar   dbExtendShell[COD_FILENAME_BUFFER_SIZE]; ~~  ~~ ~~|保存CRC值，用于数据完整性校验,yfs使能状态，默认true，不可修改，不对外提供配置接口,浮动IP使能状态，预留,YasDB使能状态,用于字节对齐,浮动IP预留,~~资源启动脚本~~,~~资源停止脚本~~,~~资源监控脚本~~,~~资源扩展脚本，作为设计预留，不开发具体功能，可以存放一个脚本，该脚本包含clean、abort、check等功能，用参数控制执行的具体命令分支~~|
|YcsYcrNodeBlock|union|YcsYcrNode ctrl,CodChar    data[YCS_BLOCK_SIZE]  |集群控制结构的具体内容,集群控制结构的缓冲区，用于缓存从ycr盘中读取的数据|
|YcsYcrNode|struct|CodUint32 checkSum;,CodUint8  nodeId;  ,CodBool   valid;   ,CodUint8  instanceMap;,CodUint8  unused; ,YcrYasdbInstance yasdbInstance[COD_MAX_DB_INSTANCE];,CodChar   nodeName[COD_MAX_NAME_LEN]; ,CodChar   ycsInterUrl[ANS_URL_BUFFER_SIZE];,CodChar   floatIp[COD_MAX_IPV6_STR_LEN];  |保存CRC值，用于数据完整性校验,节点ID,节点是否有效，在YcsYcrClu 中的nodeMap对应位置为1时这里设置为有效，也就是true,yasdb实例ID的位图，1表示对应位置被分配，0表示未分配，位置表示实例ID,用于字节对齐,yasdb实例，COD_MAX_DB_INSTANCE为8,每个node的名字,ycs之间的通信地址,浮动IP预留|
|YcrYasdbInstance|struct|CodUint8  instanceId;  ,CodChar   instanceName;,CodChar   dbStartShell[COD_MAX_NAME_LEN];   ,CodChar   dbStopShell[COD_MAX_NAME_LEN];    ,CodChar   dbMonitorShell[COD_MAX_NAME_LEN];  ,CodChar   dbExtendShell[COD_MAX_NAME_LEN];    |yasdb实例的ID,yasdb实例的名字,资源启动脚本,资源停止脚本,资源监控脚本,资源扩展脚本，作为设计预留，不开发具体功能，可以存放一个脚本，该脚本包含clean、abort、check等功能，用参数控制执行的具体命令分支|


- ycsDesc


该数据结构有变更

变更1，成员 CodUint8  resMap[YCS_MAX_NODES][YCS_MAX_RESOURCES];

拆分为如下两个成员：

    CodUint8  yasfsMap[YCS_MAX_NODES];     --保存yasfs资源的状态

    CodUint8  yasdbMap[YCS_MAX_NODES];    --保存yasdb资源的状态

变更目的：    
  为后续实现浮动IP做预留，浮动IP将会作为一种资源被管理起来，原来的二维数组虽然可以管理多种资源，但是只有两种状态，浮动IP将会有多种状态。

变更2，新增成员 CodUint64 configVer，执行除了创建集群命令外的其他配置类命令时，该成员加一，用于保证各节点处于同一版本的配置之下，当新加入的节点的configVer与当前的configVer不一致时，拒绝该节点加入集群。

- YcsClusterMngr


该数据结构有变更，新增了两个成员

CodChar*                  ycrDiskBuf;    --ycr盘的内存传冲区指针

CodDisk                   ycrDisk;          --ycr盘在内存中的句柄

- YcsNormalResDef


该结构更名为 YcsResDef

并增加成员 CodChar monitorShell[COD_FILENAME_BUFFER_SIZE];  --用于保存资源的监控脚本

- YcsProfile


该结构新增如下三个成员：

CodChar hostname[COD_HOSTNAME_BUFFER_SIZE];     --主机名

YcsResDef yasDbRes;                                                         --记录资源的启动、停止、监控的脚本

CodDiskDef ycrDiskDef;                                                     --ycr 盘的在YcsProfile中的句柄

- YcsConfirmReq


增加成员 CodUint64 configVer;      --node启动时请求加入集群，需要带上configVer，用于主节点进行configVer是否一致的对比

- YcsctlProfile


新增成员

CodDiskDef    ycrDiskDef;                         --ycr 盘的在YcsctlProfile中的句柄

CodDiskDef    votingDiskDef;                   --ycs 盘的在YcsctlProfile中的句柄

#### 5.2.2 流程设计

- ycr配置流程（预留空间没有画出）


1. 如果是“create cluster”命令，则调用doCreateCluster创建一个名为clustername 的集群，version初始化为0，nodeHWM初始化为1，nodemap初始化为0，  同时，调用ycsEnableYasfs，将enableYFS设置为true
1. ~~如果是“add res yasfs”命令，则调用ycsEnableYasfs，将RES中的enableYFS设置为true并写盘，并将version++~~  enableYFS默认为true，不对外提供配置接口
1. ~~如果是“add res yasdb”命令，则调用ycsEnableYasdb，将RES中的enableYasDB设置为true并写盘，并将version++，如果携带nodename.dbinstancename参数，则调用AddYasdbInstance函数，该函数用于在一个node下面创建多个数据库实例~~
1. 如果是“add node”命令，则调用ycsAddNode，将节点纳入管理，version++
1. 如果是”add yasdbinstance“命令，则调用doAddYasdbInstance  ，version++
1. 如果是“show config”命令，则调用ycsShowConfig


![](https://pingcode.yasdb.com/atlas/files/public/67396b14a1ad9a3311dc7fcb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

  


- 冗余设计


原理：在磁盘中开辟一个临时存储区域，写数据时，先将数据写到临时区域，待临时区域写成功后，再写到最终存储区域，读取ycr数据时，先检查临时存储区是否有效，如果有效或者CRC校验失败，则用临时存储区的数据覆盖最终存储区。

ycr配置流程中的冗余设计

1、执行ycsctl create cluster yascluster -o命令，需要先执行重置ycr redo disk，然后再开始写数据

2、执行每条命令时，同时读取ycr disk和ycr redo disk，写盘时，先写ycr redo disk，成功后，将isActiveBackup置为true

3、写ycr disk，成功后，将isActiveBackup置为false

  


ycr加载流程ycsLoadTopoConfig的冗余设计（ycr恢复）

1、同时读取ycr disk和ycr redo disk

2、进行ycr disk的CRC校验，如果存在错误，则进行ycr redo disk的CRC校验，如果成功，则用ycr redo disk覆盖ycr disk，将isActiveBackup置为false

3、判断ycr redo disk的isActiveBackup是否为true，如果是，则用ycr redo disk覆盖ycr disk，将isActiveBackup置为false，否则跳过此步骤

  


双写流程 ，包装diskwrite接口

![](https://pingcode.yasdb.com/atlas/files/public/67396b148970c2af4f520154/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

  


- 双读流程，包装diskread接口


![](https://pingcode.yasdb.com/atlas/files/public/67396b148970c2af4f520156/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

- ycsAddNode中的主函数doAddNode流程图


![](https://pingcode.yasdb.com/atlas/files/public/67396b14a1ad9a3311dc7fcd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

  


- 函数ycsShowConfig流程


1. 初始化一个ycr disk的内存结构diskBuf
1. ycsLoadYcr将ycr disk内容读入内存diskBuf
1. ctrlBlock指向diskBuf的clu位置
1. 打印ctrlBlock中的集群配置信息


  


- 启动ycs流程


1. 在启动ycs的流程中，保留原来的加载yascs.ini流程，用于读取节点的本地配置信息
1. 增加ycsLoadTopoConfig流程，读取ycr配置信息，将ycr disk中的信息加载到内存 inst


![](https://pingcode.yasdb.com/atlas/files/public/67396b14a1ad9a3311dc7fce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

  


- ycsLoadTopoConfig流程


  


![](https://pingcode.yasdb.com/atlas/files/public/67396b148970c2af4f520159/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

  


- 节点加入流程 ycsAcceptNewNode


1. 待加入节点调用ycsConfirmJoining，增加了将version放入req的步骤
1. 主节点增加了将req中的version和本地version比较的步骤，如果不相等说明Topo不一致，拒绝加入


![](https://pingcode.yasdb.com/atlas/files/public/67396b14a1ad9a3311dc7fd0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

- doRemoveNode流程


此接口为预留接口，目前没有使用

![](https://pingcode.yasdb.com/atlas/files/public/67396b14a1ad9a3311dc7fd2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

  


- AddYasdbInstance流程


![](https://pingcode.yasdb.com/atlas/files/public/67396b14a1ad9a3311dc7fd3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

  


- RemoveYasdbInstance流程


![](https://pingcode.yasdb.com/atlas/files/public/67396b148970c2af4f52015d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

- ycsLockDisk、ycsUnlockDisk接口变更


为了适应加锁、解锁ycsdisk、ycrdisk两块盘的场景，对ycsLockDisk和ycsUnlockDisk做出如下变更

原接口

CodResult ycsLockDisk(YcsClusterMngr* mngr)    
  CodResult ycsUnlockDisk(YcsClusterMngr* mngr)

新接口

CodResult ycsLockDisk(CodDisk* disk, CodChar* diskBuf, CodUint8 requestor)    
  CodResult ycsUnlockDisk(CodDisk* disk, CodChar* diskBuf)

新接口入参支持指定disk

|参数名称|参数性质|参数功能|
|:---:|---|:---:|
|CodDisk* disk|入参|待锁定的disk的句柄|
|CodChar* diskBuf|入参|待锁定的disk的缓冲区|
|CodUint8 requestor|入参|锁请求者，即nodeid|


ycsLockDisk流程

![](https://pingcode.yasdb.com/atlas/files/public/67396b15a1ad9a3311dc7fd5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

ycsUnlockDisk流程

![](https://pingcode.yasdb.com/atlas/files/public/67396b15a1ad9a3311dc7fd6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQ0FrQXdBQUFBa0FCU0FBQVlBQUFRQ01BQUF3QUFBQUFBRXlJQUNBQUtBSkFnTUNFQUFBQUFBSUFBRUFBQUNBQUlBQUVCQ0FBQUFBQUF4QWdBSUFBQVlBQUNCQkF3Q0FBQUFBQUFBQUVJQUFBQUNBQUFBQUFFQ0FBQUFBQUFBSUJBQUFBQmdBWUFBQVFnQUFCRWdDQUFnQUFBQUFVQUFBQUFnQkFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA4NDcsImV4cCI6MTc4MjMwMTY0N30.fTefkxcXojW0BMwnr1aH7q8RkIeqv-6tYy8xaboX0U8)

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

不涉及

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx%E8%AE%BE%E8%AE%A1)  

1、错误码设计

|  
|错误码|错误描述|错误含义|
|---|:---:|:---:|:---:|
|1|ERR_YCS_NODE_NOT_FOUND_ERROR|hostname %s not found in ycr|ycr disk中不存在以hostname 为名称的节点|
|2|ERR_YCS_CLUSTER_EXIST_ERROR|cluster %s exist, try with overwrite option|集群已经存在，尝试使用覆盖模式创建集群|
|3|ERR_YCS_CREATE_CLUSTER_ERROR|create cluster failed, reason: %s|创建集群失败|
|4|ERR_YCS_ADD_NODE_ERROR|add node failed, reason: %s|增加节点失败|
|5|ERR_YCS_CONFIG_RES_ERROR|config resource failed, reason: %s|配置资源适配|
|6|ERR_YCS_NO_CLUSTER_EXIST_ERROR|ycr disk not initialized|ycr disk没有初始化|
|7|ERR_YCS_ADD_DBINSTANCE_ERROR|failed to add yasdb instance, reason: %s|增加yasdb实例失败|
|8|ERR_YCS_DBINSTANCEID_EXHAUST|the number of db instances under node %s has reached the maximum limit|yasdb 实例的数量已经达到上限|
|9|ERR_YCS_REMOVE_DBINSTANCE_ERROR|failed to remove db instance, node name :%s, db instance name: %s, reason: %s|移除yasdb实例失败|
|10|ERR_YCS_CHECKSUM_ERROR|ycr checksum error|crc校验失败|
|11|ERR_YCS_NOMATCH_ERROR|invalid input parameter, reason: %s|输入的参数无效|
|12|ERR_YCS_REGMATCH_FAIL|failed to do regular expression match, reason: %s|正则表达式匹配失败|
|13|ERR_YCS_REMOVE_NODE_ERROR|failed to remove node, reason: %s|移除node失败|
|14|ERR_YCS_LOAD_DISK_ERROR|failed to load disk, reason: %s|加载disk失败|
|15|ERR_YCS_YCR_DISK_PARA_INVALID|failed to check ycs profile, reason: %s|ycs 的配置文件存在错误|
|16|ERR_YCS_SHELL_NOT_FOUND|ycs shell: %s not exist|ycs 的资源控制脚本不存在|
|17|ERR_YCS_PARA_DUPLICATE|ycs profile has duplicate parameter: %s|ycs配置文件存在重复配置|
|18|ERR_YCS_DB_JOIN_ERROR|failed to join ycs, reason: %s|db加入ycs失败|


  


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1、执行ycr全部配置

sudo setcap cap_sys_rawio=eip /home/yasdb/anchorbase/yasdb_home/bin//ycsctl    
  export YASCS_HOME=/home/yasdb/anchorbase/YASDB_NODE/node0    
  ycsctl create cluster yascluster -o    
  ycsctl add node yas1 127.0.0.1:1770    
  ycsctl add node yas2 127.0.0.1:1771    
  ycsctl add yasdbinstance yas1.yasdb start_instance0.sh stop_instance0.sh monitor_instance0.sh    
  ycsctl add yasdbinstance yas2.yasdb start_instance0.sh stop_instance0.sh monitor_instance0.sh

2、重新执行ycr配置，命令与上面相同

3、输入错误的名字，cluster name、node name、instancename 查看是否能够给出错误提示

4、输入错误的url，查看是否能够给出错误提示

5、输入错误的脚本名字，查看是否能够给出错误提示

6、输入错误的脚本后缀，查看是否能够给出错图提示

7、输入名称长度的边界值4~64以外的长度，查看是否能够给出错误提示

8、增加多个yasdb实例，目前支持8个，查看是否成功，当超过8个时，查看是否存在错误提示

9、ycsctl create cluster yascluste不加-o选项，二次执行ycsctl create cluster XXX，，查看是否存在错误提示

10、ycr创建成功后，启动、停止ycs，看是否可以成功

  


冗余设计测试用例

1、冗余盘完好，处于激活状态（期望结果，ycsctl show config后冗余盘处于失活状态，ycs正常启动）

2、冗余盘损坏，处于激活状态（期望结果，ycsctl show config报错）

3、冗余盘完好，处于失活状态，ycr盘完好（期望结果，ycsctl show config后冗余盘处于失活状态，ycs正常启动）

4、冗余盘完好，处于失活状态，ycr盘损坏（期望结果，ycsctl show config后冗余盘处于失活状态，ycs正常启动，ycr盘被修复）

5、冗余盘损坏，处于失活状态，ycr盘损坏（期望结果，ycsctl show config报错，ycr盘无法修复）

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

1.运维手册下新建共享集群管理-共享集群配置文档

2.如ycr出现在文档中，需在1参考手册-术语表中增加ycr；2doc/md-html.config中    `abbr_words变量增加ycr`  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

1、version的设计，与在线加减节点的场景矛盾，是后续需要考虑的问题

2、ycr镜像功能

3、ycr备份功能

4、ycr修改功能以及ycsctl命令并发控制

5、disk group预留以及数据结构的设计

6、浮动IP

7、监控功能

8、单节点多DB实例

## 9    [. ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)    配置样例

1、为每个节点创建配置文件 YASCS_HOME/config/yascs.ini，参数如下    
  VOTING_DISK=    [SIMS:/DEV1|16M|4K](http://SIMS/DEV1|16M|4K)      
  YCR_DISK=    [SIMS:/DEV3|100M|4K](http://SIMS/DEV3|16M|4K)      
  _HOSTNAME=yas1    
  LOG_LEVEL=DEBUG    
  AUTO_START=NEVER

2、为每个节点创建如下三个脚本    
  YASCS_HOME/startdb.sh    
  YASCS_HOME/stopdb.sh     
  YASCS_HOME/monitordb.sh

3、创建集群

sudo setcap cap_sys_rawio=eip /home/yasdb/anchorbase/yasdb_home/bin//ycsctl

export YASCS_HOME=/home/yasdb/anchorbase/YASDB_NODE/node0    
  ycsctl create cluster yascluster -o

ycsctl add node yas1 127.0.0.1:1770    
  ycsctl add node yas2 127.0.0.1:1771    
  ycsctl add node yas3 127.0.0.1:1772

ycsctl add yasdbinstance yas1.yasdb startdb.sh stopdb.sh monitordb.sh    
  ycsctl add yasdbinstance yas2.yasdb startdb.sh stopdb.sh monitordb.sh    
  ycsctl add yasdbinstance yas3.yasdb startdb.sh stopdb.sh monitordb.sh

4、查看集群配置，检查是否与第3步的配置一致    
  ycsctl show config

5、启动ycs    
  每次启动前必须设置环境变量    
  启动node0    
  export YASCS_HOME = /home/yasdb/anchorbase/YASDB_NODE/node0    
  ycsctl start ycs &

启动node1    
  export YASCS_HOME = /home/yasdb/anchorbase/YASDB_NODE/node1    
  ycsctl start ycs &

启动node2    
  export YASCS_HOME = /home/yasdb/anchorbase/YASDB_NODE/node2    
  ycsctl start ycs &

  


## Attachments:

[image2023-4-23_20-4-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTI4OTcwYzJhZjRmNTIwMTNiIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.pCEb8ndetpO-QE8L6-VV3omStF0lhkEr070vp0CunKQ)

 (image/png)    


[image2023-4-24_17-1-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTJhMWFkOWEzMzExZGM3ZmIwIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.Wu_HDIMGIBI3ocQxz8ZfQDdhUiQ1TXWpDahqJLOl7i8)

 (image/png)    


[image2023-4-24_18-46-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTJhMWFkOWEzMzExZGM3ZmIyIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.-lu8eRaZLEOM4OgzsiSGmIk5rLmZZmZURSjqHjIzTok)

 (image/png)    


[image2023-4-24_20-29-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTJhMWFkOWEzMzExZGM3ZmI0IiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.H14vNnT9aFBXFtZCoN_R6g_h7FmlT2_qbEGsEPoO7ic)

 (image/png)    


[image2023-4-24_21-7-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTJhMWFkOWEzMzExZGM3ZmI1IiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.rq2L20uZ08A0o-9s45VYcf6XB1DEgBo7kVkVKwYgRSY)

 (image/png)    


[image2023-4-25_10-26-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTI4OTcwYzJhZjRmNTIwMTNlIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.tqqlUlGVgHzQxf0URWrOEPm5Iw9Mu72_R56l1TfscD8)

 (image/png)    


[image2023-4-26_11-21-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTNhMWFkOWEzMzExZGM3ZmI5IiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.xuasrSNgmVqRak_GMu1mR0SFuBLpqYH7U-h4OnVg2wE)

 (image/png)    


[image2023-4-26_11-34-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTNhMWFkOWEzMzExZGM3ZmJhIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.GQHdR28XQI3gmSooCcn2CBK-ptJttZ-hRJXX1OEQh2k)

 (image/png)    


[image2023-4-26_11-37-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTM4OTcwYzJhZjRmNTIwMTQyIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.vT_iC-Al39g-41muA5BjYVQlwBGLGsi15MI5HyerA1Y)

 (image/png)    


[image2023-4-26_11-41-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTM4OTcwYzJhZjRmNTIwMTQzIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.naQ0Ih7CvCFSJBLSlQsFXXmzJndisHR78BJo3qsjies)

 (image/png)    


[image2023-5-5_14-57-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTNhMWFkOWEzMzExZGM3ZmJjIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.r-upSeSw8AMFwHezY_eWK_2y3KzjavaevjZmPVCoMoQ)

 (image/png)    


[image2023-5-5_16-41-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTM4OTcwYzJhZjRmNTIwMTQ2IiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.NcIr10Ev6jBDnAuj9QchHWtBkAZuzT6z1Umq_6R-P1g)

 (image/png)    


[image2023-5-5_21-32-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTM4OTcwYzJhZjRmNTIwMTQ4IiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.yAgWABwWigoPK62RTVl2UZX-fKmY-xgV4tWPq4taqYk)

 (image/png)    


[image2023-5-5_21-33-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTNhMWFkOWEzMzExZGM3ZmJlIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.OP86yneio0PE4Vt45yrKZPW7FAyy97k9wcb8--1cBA8)

 (image/png)    


[image2023-5-5_21-55-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTNhMWFkOWEzMzExZGM3ZmMxIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.VrB6ClUYK_Bq1hqeVPyOT2txsoNPsl7aTihS1dmlaAw)

 (image/png)    


[image2023-5-8_21-17-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTM4OTcwYzJhZjRmNTIwMTRiIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.EVfuiJz4P9m7IW60-FglNVVncbkRrTRzYN04MbdFwJk)

 (image/png)    


[image2023-7-8_10-58-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTRhMWFkOWEzMzExZGM3ZmM2IiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.8byxhOGIUdQ7ZXiB6xKk2bmd98S7FUIdbkuHNOMe6gQ)

 (image/png)    


[image2023-7-8_11-29-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTQ4OTcwYzJhZjRmNTIwMTUwIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.aMwmbFMywYGgY7cdmyIC2U6fSav9ikWeHuREB_2cW9M)

 (image/png)    


[image2023-7-8_11-29-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTQ4OTcwYzJhZjRmNTIwMTUxIiwicmVmX2lkIjoiNjczOTZiMTI1OTNmOTljOWZmMjM1ZGE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwODQ3LCJleHAiOjE3ODIzNzcyNDd9.OyV68pO65B3UX4upHFnulVNobEH5PFilRcsMjdjANP0)

 (image/png)    

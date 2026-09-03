Created by 韦庭德 on 十二月 20, 2023

# **一.**  ** **  **概述**

yfs 功能基本可用，需要增加 yfs 的可观测性，前期为便于测试，已在 yfscmd 中实现了查看 diskgroup、failgroup、disk 的指令。

本次目标：

- 允许查看 YFS 更详细的内部状态

- 更多的信息用 yfscmd 显示不便，在 DB 中增加 YFS 统计信息动态视图。

# **二.**  ** **  **需求分析**

DB 新增 4 个 YFS 动态视图：

- V$YFS_DISKGROUP

- V$YFS_FAILGROUP

- V$YFS_DISK

- V$YFS_FILE

# **三.**  ** **  **测试设计方法**

等价类，正交，场景。

  


# **四.**  ** **  **详细测试设计**

- 创建不同规格的 Diskgroup，查看 视图 信息与创建规格一致。

- 通过 `alter` 调整后查看视图与预期一致。

- 执行 IO 后查看 `V$YFS_DISK` 视图的 `READS` `WRITES` 统计信息与预期一致。

### 1、通过DB视图

#### 1.1  V$YFS_DISKGROUP

|字段|类型|描述|
|:---|:---|:---|
|ID|INTEGER|全局 Diskgroup ID|
|NAME|VARCHAR(32)|名称|
|AU_SIZE|INTEGER|Allocate Unit size|
|BLOCK_SIZE|INTEGER|总是 4K|
|REDUNDANCY|VARCHAR(16)|冗余度，external、normal、high|
|STATE|VARCHAR(16)|dg 状态，broken、mounted、dismounted|
|TOTAL_MB|BIGINT|总磁盘空间|
|FREE_MB|BIGINT|可用空间|
|USABLE_FILE_MB|BIGINT|可用文件空间|


USABLE_FILE_MB 表示 DG 内最大还能写入多大的文件，通常为比 FREE_MB/副本数 较小一点的值。

#### 1.2 V$YFS_FAILGROUP

|字段|类型|描述|
|:---|:---|:---|
|ID|INTEGER|Diskgroup 内 ID|
|GLOBAL_ID|INTEGER|全局 ID|
|NAME|VARCHAR(32)|名称|
|GROUP_NUMBER|INTEGER|所属 Diskgroup 的 ID|


#### 1.3 V$YFS_DISK

|字段|类型|描述|
|:---|:---|:---|
|ID|INTEGER|Diskgroup 内 ID|
|GLOBAL_ID|INTEGER|全局 ID|
|NAME|VARCHAR(32)|名称|
|GROUP_NUMBER|INTEGER|所属 Diskgroup 的 ID|
|MOUNT_STATUS|VARCHAR(16)|状态，unknown、normal、adding、dropping、hung、forcing, closed。,所属 dg  mount 状态，显示 normal；,所属 dg dismount 状态，显示 closed|
|REDUNDANCY|VARCHAR(16)|EXTERNAL,NORMAL,HIGH|
|TOTAL_MB|BIGINT|总容量|
|FREE_MB|BIGINT|可用容量|
|PATH|VARCHAR(32)|路径|
|FAILGROUP_ID|INTEGER|所属 Failgroup id|
|FAILGROUP_LABEL|VARCHAR(32)|Failgroup 名称|
|YFS 新增|  
|  
|
|PARTHNERS|VARCHAR(161)|伙伴磁盘清单|
|READS|BIGINT|Read requests for the disk|
|WRITES|BIGINT|Write requests for the disk|
|BYTES_READ|BIGINT|Bytes read from the disk|
|BYTES_WRITTEN|BIGINT|Bytes write to the disk|
|READ_TIME|BIGINT|Read I/O time, seconds|
|WRITE_TIME|BIGINT|Write I/O time, seconds|


#### 1.4 V$YFS_FILE

|字段|类型|描述|
|:---|:---|:---|
|FILE_NUMBER|INTEGER|fd|
|COMPOUND_INDEX|INTEGER|dgid + fd|
|GROUP_NUMBER|INTEGER|DiskGroup id|
|BLOCK_SIZE|INTEGER|au size|
|BLOCKS|BIGINT|au count|
|BYTES|BIGINT|文件字节数|
|REDUNDANCY|VARCHAR(16)|冗余度|
|CREATION_DATE|DATE|创建时间|
|YFS 新增|  
|  
|
|DELETE_TIME|DATE|删除时间|


### 2、通过YFSCMD

#### 2.1 show diskgroup

#### 2.2 show failgroup

#### 2.3 show disk

# **五.**  ** **  **测试用例**

**diskgroup操作**

  
  **create diskgroup**    
  **CREATE DISKGROUP data NORMAL REDUNDANCY **    
  **DISK '/dev/asmdisks/asmdisk0aw' [NAME disk1] [SIZE 100M]**    
  **DISK '/dev/asmdisks/asmdisk0ao' [NAME disk2] [SIZE 100M] [FORCE | NOFORCE]**    
  **[REGULAR][QUORUM]FAILGROUP controller2 DISK '/dev/asmdisks/asmdisk0aq' NAME disk3, '/dev/asmdisks/asmdisk0aq' NAME disk4**    
  **FAILGROUP...**    
  **ATTRIBUTE 'au_size'='4M';**

  
  **drop diskgroup**    
  **DROP DISKGROUP data [INCLUDING CONTENTS];**

  
  **alter diskgroup**    
  **ALTER DISKGROUP data DISMOUNT**    
  **ALTER DISKGROUP data MOUNT**    
  **ALTER DISKGROUP data ADD[FAILGROUP fg_name] DISK disk_path [NAME disk_name] [SIZE disk_size]**

|功能|前置|操作|预期|备注：以下所有场景遍历执行数据库业务前后，验证执行数据库业务前后的统计信息|
|---|---|---|---|---|
|V$YFS_DISKGROUP视图信息统计    
    
|启动集群，初始状态DB下|select * from V$YFS_DISKGROUP;|V$YFS_DISKGROUP视图信息，显示正常，无乱码,显示所有字段：ID、NAME、AU_SIZE、BLOCK_SIZE、REDUNDANCY、STATE、FREE_MB、TOTAL_MB、USABLE_FILE_MB|  
,新加入节点后，查询统计信息，以上三个操作都遍历（启动集群，初始状态DB下；修改DISKGROUP，alter diskgroup；删除DISKGROUP，drop diskgroup）下同    
  节点退出后，查询统计信息，以上三个操作都遍历,  
,  
,  
,  
,  
,  
,  
|
|||select ID,NAME,AU_SIZE,BLOCK_SIZE,REDUNDANCY,STATE,FREE_MB,TOTAL_MB,USABLE_FILE_MB from V$YFS_DISKGROUP;|V$YFS_DISKGROUP视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME、AU_SIZE、BLOCK_SIZE、REDUNDANCY、STATE、FREE_MB、TOTAL_MB、USABLE_FILE_MB||
|||select ID,NAME,AU_SIZE from V$YFS_DISKGROUP;|V$YFS_DISKGROUP视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME、AU_SIZE||
||修改DISKGROUP，alter diskgroup|select * from V$YFS_DISKGROUP;|V$YFS_DISKGROUP视图信息，显示正常，无乱码,显示所有字段：ID、NAME、AU_SIZE、BLOCK_SIZE、REDUNDANCY、STATE、FREE_MB、TOTAL_MB、USABLE_FILE_MB||
|||select ID,NAME,AU_SIZE,BLOCK_SIZE,REDUNDANCY,STATE,FREE_MB,TOTAL_MB,USABLE_FILE_MB from V$YFS_DISKGROUP;|V$YFS_DISKGROUP视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME、AU_SIZE、BLOCK_SIZE、REDUNDANCY、STATE、FREE_MB、TOTAL_MB、USABLE_FILE_MB||
|||select ID,NAME,AU_SIZE from V$YFS_DISKGROUP;|V$YFS_DISKGROUP视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME、AU_SIZE||
||删除DISKGROUP，drop diskgroup|select * from V$YFS_DISKGROUP;|V$YFS_DISKGROUP视图信息，显示正常，无乱码,显示所有字段：ID、NAME、AU_SIZE、BLOCK_SIZE、REDUNDANCY、STATE、FREE_MB、TOTAL_MB、USABLE_FILE_MB||
|||select ID,NAME,AU_SIZE,BLOCK_SIZE,REDUNDANCY,STATE,FREE_MB,TOTAL_MB,USABLE_FILE_MB from V$YFS_DISKGROUP;|V$YFS_DISKGROUP视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME、AU_SIZE、BLOCK_SIZE、REDUNDANCY、STATE、FREE_MB、TOTAL_MB、USABLE_FILE_MB||
|||select ID,NAME,AU_SIZE from V$YFS_DISKGROUP;|V$YFS_DISKGROUP视图信息，所选的查询字段显示正常，无乱码    
  显示所有字段：ID、NAME、AU_SIZE||
|V$YFS_FAILGROUP视图信息统计|启动集群，初始状态DB下|select * from V$YFS_FAILGROUP;|V$YFS_FAILGROUP视图信息，显示正常，无乱码    
  显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER|新加入节点后，查询统计信息，以上三个操作都遍历,节点退出后，查询统计信息，以上三个操作都遍历|
|||select ID,NAME,GLOBAL_ID,GROUP_NUMBER from V$YFS_FAILGROUP;|V$YFS_FAILGROUP视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER||
|||select ID,NAME from V$YFS_FAILGROUP;|V$YFS_FAILGROUP视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME||
||修改DISKGROUP，alter diskgroup|select * from V$YFS_FAILGROUP;|V$YFS_FAILGROUP视图信息，显示正常，无乱码,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER||
|||select ID,NAME,GLOBAL_ID,GROUP_NUMBER from V$YFS_FAILGROUP;|V$YFS_FAILGROUP视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER||
|||select ID,NAME from V$YFS_FAILGROUP;|V$YFS_FAILGROUP视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME||
||删除DISKGROUP，drop diskgroup|select * from V$YFS_FAILGROUP;|V$YFS_FAILGROUP视图信息，显示正常，无乱码,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER||
|||select ID,NAME,GLOBAL_ID,GROUP_NUMBER from V$YFS_FAILGROUP;|V$YFS_FAILGROUP视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER||
|||select ID,NAME from V$YFS_FAILGROUP;|V$YFS_FAILGROUP视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME||
|V$YFS_DISK视图信息统计|启动集群，初始状态DB下|select * from V$YFS_DISK;|V$YFS_DISK视图信息，显示正常，无乱码,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER、MOUNT_STATUS、REDUNDANCY、TOTAL_MB、FREE_MB、PATH、FAILGROUP_ID、FAILGROUP_LABEL、PARTHNERS、READS、WRITES、BYTES_READ、BYTES_WRITTEN、READ_TIME、WRITE_TIME|新加入节点后，查询统计信息，以上三个操作都遍历,节点退出后，查询统计信息，以上三个操作都遍历|
|||select ID,NAME,GLOBAL_ID,GROUP_NUMBER,MOUNT_STATUS from V$YFS_DISK;|V$YFS_DISK视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER、MOUNT_STATUS||
|||select ID,NAME from V$YFS_DISK;|V$YFS_DISK视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME||
||修改DISKGROUP，alter diskgroup|select * from V$YFS_DISK;|V$YFS_DISK视图信息，显示正常，无乱码,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER、MOUNT_STATUS、REDUNDANCY、TOTAL_MB、FREE_MB、PATH、FAILGROUP_ID、FAILGROUP_LABEL、PARTHNERS、READS、WRITES、BYTES_READ、BYTES_WRITTEN、READ_TIME、WRITE_TIME||
|||select ID,NAME,GLOBAL_ID,GROUP_NUMBER,MOUNT_STATUS from V$YFS_DISK;|V$YFS_DISK视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER、MOUNT_STATUS||
|||select ID,NAME from V$YFS_DISK;|V$YFS_DISK视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME||
||删除DISKGROUP，drop diskgroup|select * from V$YFS_DISK;|V$YFS_DISK视图信息，显示正常，无乱码,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER、MOUNT_STATUS、REDUNDANCY、TOTAL_MB、FREE_MB、PATH、FAILGROUP_ID、FAILGROUP_LABEL、PARTHNERS、READS、WRITES、BYTES_READ、BYTES_WRITTEN、READ_TIME、WRITE_TIME||
|||select ID,NAME,GLOBAL_ID,GROUP_NUMBER,MOUNT_STATUS from V$YFS_DISK;|V$YFS_DISK视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER、MOUNT_STATUS||
|||select ID,NAME from V$YFS_DISK;|V$YFS_DISK视图信息，所选的查询字段显示正常，无乱码,显示所有字段：ID、NAME||
||执行IO，增删大量的数据,DB下插入数据、yfscmd插入数据|select * from V$YFS_DISK;|V$YFS_DISK视图信息，显示正常，无乱码；观察READS、WRITES字段统计数据的变化情况,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER、MOUNT_STATUS、REDUNDANCY、TOTAL_MB、FREE_MB、PATH、FAILGROUP_ID、FAILGROUP_LABEL、PARTHNERS、READS、WRITES、BYTES_READ、BYTES_WRITTEN、READ_TIME、WRITE_TIME||
|||select ID,NAME,GLOBAL_ID,GROUP_NUMBER,MOUNT_STATUS,READS,WRITES from V$YFS_DISK;|V$YFS_DISK视图信息，所选的查询字段显示正常，无乱码；观察READS、WRITES字段统计数据的变化情况,显示所有字段：ID、NAME、GLOBAL_ID、GROUP_NUMBER、MOUNT_STATUS||
|V$YFS_FILE视图信息统计    
    
    
    
    
|启动集群，初始状态DB下    
    
|select * from V$YFS_FILE;|V$YFS_FILE视图信息，显示正常，无乱码,显示所有字段：FILE_NUMBER、COMPOUND_INDEX、GROUP_NUMBER、BLOCK_SIZE、BLOCKS、BYTES、REDUNDANCY、CREATION_DATE、DELETE_TIME|  
  新加入节点后，查询统计信息，以上三个操作都遍历    
    
    
  节点退出后，查询统计信息，以上三个操作都遍历    
    
,  
,  
|
|||select FILE_NUMBER,COMPOUND_INDEX,GROUP_NUMBER,BLOCK_SIZE,BLOCKS,BYTES,REDUNDANCY,CREATION_DATE,DELETE_TIME from V$YFS_FILE;|V$YFS_FILE视图信息，显示正常，无乱码,显示所有字段：FILE_NUMBER、COMPOUND_INDEX、GROUP_NUMBER、BLOCK_SIZE、BLOCKS、BYTES、REDUNDANCY、CREATION_DATE、DELETE_TIME||
|||select FILE_NUMBER,COMPOUND_INDEX,GROUP_NUMBER,BLOCK_SIZE from V$YFS_FILE;|V$YFS_FILE视图信息，所选的查询字段显示正常，无乱码,显示所有字段：FILE_NUMBER、COMPOUND_INDEX、GROUP_NUMBER、BLOCK_SIZE||
||修改DISKGROUP，alter diskgroup    
    
|select * from V$YFS_FILE;|V$YFS_FILE视图信息，显示正常，无乱码,显示所有字段：FILE_NUMBER、COMPOUND_INDEX、GROUP_NUMBER、BLOCK_SIZE、BLOCKS、BYTES、REDUNDANCY、CREATION_DATE、DELETE_TIME||
|||select FILE_NUMBER,COMPOUND_INDEX,GROUP_NUMBER,BLOCK_SIZE,BLOCKS,BYTES,REDUNDANCY,CREATION_DATE,DELETE_TIME from V$YFS_FILE;|V$YFS_FILE视图信息，显示正常，无乱码,显示所有字段：FILE_NUMBER、COMPOUND_INDEX、GROUP_NUMBER、BLOCK_SIZE、BLOCKS、BYTES、REDUNDANCY、CREATION_DATE、DELETE_TIME||
|||select FILE_NUMBER,COMPOUND_INDEX,GROUP_NUMBER,BLOCK_SIZE from V$YFS_FILE;|V$YFS_FILE视图信息，所选的查询字段显示正常，无乱码,显示所有字段：FILE_NUMBER、COMPOUND_INDEX、GROUP_NUMBER、BLOCK_SIZE||
||删除DISKGROUP，drop diskgroup|select * from V$YFS_FILE;|V$YFS_FILE视图信息，显示正常，无乱码,显示所有字段：FILE_NUMBER、COMPOUND_INDEX、GROUP_NUMBER、BLOCK_SIZE、BLOCKS、BYTES、REDUNDANCY、CREATION_DATE、DELETE_TIME||
|||select FILE_NUMBER,COMPOUND_INDEX,GROUP_NUMBER,BLOCK_SIZE,BLOCKS,BYTES,REDUNDANCY,CREATION_DATE,DELETE_TIME from V$YFS_FILE;|V$YFS_FILE视图信息，显示正常，无乱码,显示所有字段：FILE_NUMBER、COMPOUND_INDEX、GROUP_NUMBER、BLOCK_SIZE、BLOCKS、BYTES、REDUNDANCY、CREATION_DATE、DELETE_TIME||
|||select FILE_NUMBER,COMPOUND_INDEX,GROUP_NUMBER,BLOCK_SIZE from V$YFS_FILE;|V$YFS_FILE视图信息，所选的查询字段显示正常，无乱码,显示所有字段：FILE_NUMBER、COMPOUND_INDEX、GROUP_NUMBER、BLOCK_SIZE||


# **六.**  ** **  **测试框架**

  


# **七.**  ** **  **测试环境说明**
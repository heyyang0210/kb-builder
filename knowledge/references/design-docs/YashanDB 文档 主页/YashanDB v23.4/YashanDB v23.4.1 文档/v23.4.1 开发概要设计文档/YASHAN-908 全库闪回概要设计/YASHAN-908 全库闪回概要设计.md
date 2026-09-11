IR链接：  [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2dc?](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2dc?)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

当数据库产生逻辑损坏（如误操作）或者物理损坏（如磁盘坏块时），通常需要通过备份恢复来将数据库恢复到某个时间点。但是传统的备份恢复技术的恢复时间与库大小成正比，这就导致在库比较大时可能因为一个很小的错误需要花费很长时间来完成整库的恢复。而全库闪回技术提供了一种高效的数据恢复机制，恢复时间不再受数据库本身大小的影响，可以在较短的时间内将一个很大的数据库恢复至某个时间点。

###   [1.2 需求分析](#13-需求分析)  

将数据库恢复到某一个时间点通常会采用基于备份集的PITR技术，即首先通过备份集将数据库恢复到一个基线，然后通过REDO日志将数据库回放到指定时间点，以下是PITR的流程：

![image.png](https://pingcode.yasdb.com/atlas/files/public/67aaa766d6fcabebff225987/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBZ0VBZ0FBQUFBUUFDQUFBQUFCUUNBQUFFQUFBQUJBQUlBQUFBUUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFCQUFFQUFCQUFFUUFBQW9BQUFBSUFBQUFBQUFBQUFBa0FDQUFBRUFBSUFBQUFBQUFBQUFBaEFJQUFBQUFBQWdDQUVBQUFnQUFBQUFBQUlBQUFBQUFBQUVBQUVBQUFBUUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1NTUsImV4cCI6MTc4MjQ2NzM1NX0.uhAMRaaUdnIr2OM4o6aEFaGUxLrCGZxH4ZnQEPA7wCM)

数据库闪回技术的目的与PITR相同，但不同的是基线数据库的恢复方式，PITR使用备份集全量恢复而全库闪回通过flashback log回退修改的数据：

![image.png](https://pingcode.yasdb.com/atlas/files/public/67aaf44e98ac295b69be0cc9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBZ0VBZ0FBQUFBUUFDQUFBQUFCUUNBQUFFQUFBQUJBQUlBQUFBUUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFCQUFFQUFCQUFFUUFBQW9BQUFBSUFBQUFBQUFBQUFBa0FDQUFBRUFBSUFBQUFBQUFBQUFBaEFJQUFBQUFBQWdDQUVBQUFnQUFBQUFBQUlBQUFBQUFBQUVBQUVBQUFBUUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1NTUsImV4cCI6MTc4MjQ2NzM1NX0.uhAMRaaUdnIr2OM4o6aEFaGUxLrCGZxH4ZnQEPA7wCM)

几种常用恢复技术的对比：

|**对比项**|**flashback database**|**PITR**|**flashback query / table / drop**|
|:---:|:---:|:---:|:---:|
|技术实现|flashback log + redo回放实现整库恢复|文件复制 + redo回放|依赖undo和回收站；基于对象级|
|类似成熟产品|oracle / SQLServer / recoverPoint|oracle /  SQLServer / yasdb|oracle / OB 等商业数据库|
|主备脑裂快速修复|支持|重建，耗时|N/A|
|使用场景|整库快速恢复（主备、升级、数据错误）+ 历史追踪|所有数据恢复场景|少量对象恢复|
|性能影响|开启后性能预估会下降8%左右|备份期间|无|
|恢复所需时间|秒级|小时级|秒级|


全库闪回设计上主要考虑功能、性能、可维可测、安全等能力：

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|打开和关闭全库闪回|1. 启用flashback log，分配内存，启动后台线程。
1. 删除flashback log，释放内存，停止后台线程。
|是|是|  [https://pingcode.yasdb.com/pjm/items/6618dd8bfd997db58ad8177f?](https://pingcode.yasdb.com/pjm/items/6618dd8bfd997db58ad8177f?)  ,#YDBRD-26148 单机支持flashback database|
||创建和删除还原点| flashback ctrl file中记录和删除还原点信息|是|是||
||执行全库闪回|根据flashback log先回退数据库到最近的时间点，然后使用redo回放到指定时间点。|是|是||
|性能|启用flashback后，数据库业务性能劣化不高于10%|1. 对内存中的fb buffer进行分区，降低缓存写入冲突。
1. fb log采用异步按需刷盘机制，不阻塞前台业务。
1. 引入fb marker机制，同一时间区间内对相同block的修改不重复记录fb log。
|是|是|NA|
||闪回性能不低于竞品（暂未实测）|1. 通过marker快速查找闪回结束点。
1. 对于同一个block的多次修改，只需要闪回一次到最旧的版本。
|是|是|NA|
|可维可测|观测手段|提供视图展示还原点信息|否 |是|NA|
|周边配合|权限|新增flashback database的权限控制|否|是|NA|
|周边配合|审计|新增flashback database相关审计|否|是|NA|


###   [1.3 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|PITR|基于redo日志将数据库回放到指定时间点|是|NA|
|fb|flashback database|否|NA|


###   [1.4 开源依赖](#15-开源依赖)  

不涉及

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|alter database flashback on;|打开全库闪回|是|
|SQL语法|alter database flashback off;|关闭全库闪回|是|
|SQL语法|create restore point|创建还原点|是|
|SQL语法|drop restore point|删除还原点|是|
|SQL语法|flashback database to xxx;|闪回数据库|是|
|动态视图|V$FLASHBACK_DATABASE_LOG,V$FLASHBACK_DATABASE_LOGFILE,v$RESTORE_POINT    |查询闪回日志以及还原点信息|是|
|配置参数|db_flashback_retention_target|用于控制flashback database log file的保留时间，单位分钟|是|
|配置参数|db_flashback_file_dest_size|用于控制flashback database log file的目录的大小，单位MB|是|


##   [3. 规格与约束](#3-规格与约束)  

### 规格

1. 支持单机和主备；主备独立开启闪回。（主备仅支持演练场景）
1. 支持所有dml、dcl；支持除表空间和数据文件操作外的所有DDL。
1. 闪回操作的粒度是整个数据库，但不闪回临时表空间、slice、VM、SWAP、双写文件、参数文件、redo文件。
1. 闪回日志flashback log可按需设置保留策略，默认保留时间为2天；关闭数据库闪回将删除全部闪回日志，但如果存在guarantee还原点，则无法关闭闪回。
1. 使用Flashback Database 能回退到的最早的SCN， 取决于flashback Log file中的最小的SCN。
1. 数据库open状态开启和关闭flashback database功能；使用flashback database 回退数据库必须以mount状态。
1. 恢复后完成，主库要以open resetlogs；备库使用open
1. 开启flashback database功能前，数据库必须开启归档模式，  flashback database依赖arch和redo进行恢复


### 约束

1. 不支持集群、分布式
1. 不支持列存（lsc slice格式），闪回后冷数据物理文件会存在残留，需手动删除。
1. 暂不支持表空间DDL，若开启闪回期间执行DDL，则无法闪回到执行的时间点以前。
1. 闪回后数据库状态为DATABASE_OPEN_PHASE2，因此无法闪回后直接进行连续闪回或recover database，需要shutdown后进行闪回或recover database。
1. 闪回后只能open resetlogs，如果shutdown后直接open，会变成recover database恢复到最新时间点。
1. 不支持循环恢复（闪回完成后read only打开数据库查看结果是否满意，不满意可以shutdown做pitr恢复到原始状态）。
1. oracle的还原点是独立存在，闪回关闭后还原点仍旧存在，而yashanDB则会把还原点一同清除。
1. 不支持闪回到不同时间线的还原点。


##   [4. 特性](#4-特性)  

全库闪回在设计上要考虑以下几个问题：

1. 如何定义数据库的状态：闪回的目的是将数据库从最新状态切换到一个历史状态，而决定数据库状态的包括数据和元数据两部分信息。
1. 需要闪回哪些信息：所有决定数据库状态的信息都需要删除，数据的载体是数据块，而元数据的载体是数据块和控制文件，因此需要闪回数据块和控制文件信息。
1. 如何闪回这些信息：闪回是个反向覆盖的过程，但是跟undo的逻辑rollback不同，全库闪回需要进行物理上的覆盖，因此需要通过额外的日志来记录变更。
1. 如何降低闪回日志对性能的影响：如果每一个修改都记录闪回日志，会对性能影响非常大，可以在一个周期内的多次修改只记录第一修改的闪回日志，并且引入缓存机制来加速。
1. 如何进行恢复：由于同一周期内的多次修改只记录第一次修改的日志，恢复时首先通过闪回日志将数据库还原到最近一个某个周期的起始点，然后再通过redo回放到指定的时间点。


基于WAL机制的存储引擎，对于数据库的修改发生在REDO日志生成的时候（产生全局LSN的时候），而且真实的数据修改是异步完成的。假设没有数据异步刷盘机制，那么数据库的闪回实际上就是将日志刷盘点修改为历史上的某个日志点，然后把数据库基于REDO恢复到新的日志点。但是当有异步刷盘机制之后，真实的数据修改可能已经落盘，需要先把修改的数据还原，然后再通过REDO恢复，因此需要记录数据的历史修改，这也是全库闪回最核心的机制闪回日志机制的由来。

###   [4.1 闪回日志](#41-特性功能点1)  

####   [4.1.1 闪回日志结构](#41-特性功能点1)  

主要包括：flashback file header，fb pack head/tail，fb record head，fb log（flashback checkpoint、befor image）；不同的场景存在不同的日志格式，常规为整个数据块 + log header

![WXWorkLocalPro_17403884446942.png](https://pingcode.yasdb.com/atlas/files/public/67bc387539823f2ac1f25fc3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBZ0VBZ0FBQUFBUUFDQUFBQUFCUUNBQUFFQUFBQUJBQUlBQUFBUUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFCQUFFQUFCQUFFUUFBQW9BQUFBSUFBQUFBQUFBQUFBa0FDQUFBRUFBSUFBQUFBQUFBQUFBaEFJQUFBQUFBQWdDQUVBQUFnQUFBQUFBQUlBQUFBQUFBQUVBQUVBQUFBUUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1NTUsImV4cCI6MTc4MjQ2NzM1NX0.uhAMRaaUdnIr2OM4o6aEFaGUxLrCGZxH4ZnQEPA7wCM)

flashback log file使用append的方式写入。

flashback log file使用固定大小，每个文件1GB；写满后将自动新增文件。

![WXWorkLocalPro_17403857054032.png](https://pingcode.yasdb.com/atlas/files/public/67bc2db76a1ae92ae373653f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBZ0VBZ0FBQUFBUUFDQUFBQUFCUUNBQUFFQUFBQUJBQUlBQUFBUUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFCQUFFQUFCQUFFUUFBQW9BQUFBSUFBQUFBQUFBQUFBa0FDQUFBRUFBSUFBQUFBQUFBQUFBaEFJQUFBQUFBQWdDQUVBQUFnQUFBQUFBQUlBQUFBQUFBQUVBQUVBQUFBUUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1NTUsImV4cCI6MTc4MjQ2NzM1NX0.uhAMRaaUdnIr2OM4o6aEFaGUxLrCGZxH4ZnQEPA7wCM)

flashback log元数据（类似rman备份信息）存储在flashback专门的catalog文件中，包括如下

1. restore point：分为普通还原点和guarantee还原点；还原点数量最多为8192个
1. flashback log的文件信息、状态、文件链表，文件上限最多为8192个


####   [4.1.1 闪回日志写入](#41-特性功能点1)  

每次数据库块在被覆盖写入之前，将被覆盖的数据库块内容复制出来并打上时间戳单独存放到另外的空间中然后再覆盖写入。

1. 全局buffer：flashback buffer，用来缓存flashback log，执行flashback log刷盘
1. rvwr线程：执行flush flashback buffer并以append写入flashback log file


![image.png](https://pingcode.yasdb.com/atlas/files/public/67aaf67f98ac295b69be0cd1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBZ0VBZ0FBQUFBUUFDQUFBQUFCUUNBQUFFQUFBQUJBQUlBQUFBUUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFCQUFFQUFCQUFFUUFBQW9BQUFBSUFBQUFBQUFBQUFBa0FDQUFBRUFBSUFBQUFBQUFBQUFBaEFJQUFBQUFBQWdDQUVBQUFnQUFBQUFBQUlBQUFBQUFBQUVBQUVBQUFBUUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1NTUsImV4cCI6MTc4MjQ2NzM1NX0.uhAMRaaUdnIr2OM4o6aEFaGUxLrCGZxH4ZnQEPA7wCM)

flashback log写入过程如下：

1. flashback全局buffer是  **双buffer结构**  ，每个buffer大小为 Flashback buffer 的一半，当某个handler的FBuffer往全局flashback buffer写入时，首先会根据HANDLER_ID哈希选择一个flashback buffer part。
1. 然后对  **part加锁**  ，判断可用空间，获取占位指针，放锁，将FBuffer拷贝到所占空间内。如果可用空间不足，需要先执行flashlog flush。
1. 执行  **flashlog flush**  时，先将双buffer切换，后续的私有FBuffer将push到buffer B的part上。
1. memmov合并组装，执行flush刷盘


   **flashback log写入和写入线程rvwr**

1. 每3秒将flashback buffer中的flush磁盘上
1. 被dbwr唤醒写入（checkpoint 或者 buffer_clean）
1. 每默认1800秒插入闪回标记（flashback markers）到flashback database logs中。




![image.png](https://pingcode.yasdb.com/atlas/files/public/67aaff9698ac295b69be0cdf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBZ0VBZ0FBQUFBUUFDQUFBQUFCUUNBQUFFQUFBQUJBQUlBQUFBUUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFCQUFFQUFCQUFFUUFBQW9BQUFBSUFBQUFBQUFBQUFBa0FDQUFBRUFBSUFBQUFBQUFBQUFBaEFJQUFBQUFBQWdDQUVBQUFnQUFBQUFBQUlBQUFBQUFBQUVBQUVBQUFBUUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1NTUsImV4cCI6MTc4MjQ2NzM1NX0.uhAMRaaUdnIr2OM4o6aEFaGUxLrCGZxH4ZnQEPA7wCM)

为了提升性能，version使用原子变量和mfence实现，bufferCtrl上添加version标记。

默认以30分钟为间隔写入marker标记位到flashback log中，marker的写入流程如下：

1. 获取系统当前的scn、lsn、flushPoint、instCtrl，并将marker的version +1 在flashback buffer中生成新的marker，（version存储信息为version和scn）
1. 切换buffer；flush flashback buffer到磁盘
1. 写入marker标记到flashback log文件


###   [4.3 闪回流程](#43-特性性能点1)  

需要将数据库启动到mount；数据库闪回过程与PITR过程类似，分为restore和recover两个阶段

![image.png](https://pingcode.yasdb.com/atlas/files/public/67ab013a98ac295b69be0ce6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBZ0VBZ0FBQUFBUUFDQUFBQUFCUUNBQUFFQUFBQUJBQUlBQUFBUUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFCQUFFQUFCQUFFUUFBQW9BQUFBSUFBQUFBQUFBQUFBa0FDQUFBRUFBSUFBQUFBQUFBQUFBaEFJQUFBQUFBQWdDQUVBQUFnQUFBQUFBQUlBQUFBQUFBQUVBQUVBQUFBUUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1NTUsImV4cCI6MTc4MjQ2NzM1NX0.uhAMRaaUdnIr2OM4o6aEFaGUxLrCGZxH4ZnQEPA7wCM)

#### **restore**

- 将修改过的数据进行版本还原；具体为使用flashback log还原


详细执行过程如下：

1. flashback catalog中定位所需flashback log文件集
1. 从flashback log文件集中选取最小序号的文件，逆序扫描最新的Marker，获取第一个小于目标scn的maerk作为截止点
1. 从最新flashback log开始还原到目标marker；并对每个marker的blockId去重判断


#### **recover**

- 并行回放所需的归档或redo日志（此阶段与PITR的recover类似）


详细执行过程如下：

1. 根据marker标记的rcyBegin点开始回放redo
1.  回放到截止点的scn


![image.png](https://pingcode.yasdb.com/atlas/files/public/67aaffc398ac295b69be0ce0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBZ0VBZ0FBQUFBUUFDQUFBQUFCUUNBQUFFQUFBQUJBQUlBQUFBUUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFCQUFFQUFCQUFFUUFBQW9BQUFBSUFBQUFBQUFBQUFBa0FDQUFBRUFBSUFBQUFBQUFBQUFBaEFJQUFBQUFBQWdDQUVBQUFnQUFBQUFBQUlBQUFBQUFBQUVBQUVBQUFBUUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1NTUsImV4cCI6MTc4MjQ2NzM1NX0.uhAMRaaUdnIr2OM4o6aEFaGUxLrCGZxH4ZnQEPA7wCM)

###   [4.4 安全设计](#44-特性性能点2)  

|开启/关闭数据库闪回|与alter database权限一致|alter database flashback on/off;|　|
|:---|:---|:---|:---|
|闪回数据库、  创建删除guarantee还原点|sysdba|flashback database to xxx;,create restore point xxx guarantee flashback database;,drop restore point xxx;|  
|
|创建删除普通还原点|flashback any table及以上权限|create/drop restore point xxx；|  
|
|视图查询|dba或专门查询权限|V$FLASHBACK_DATABASE_LOG,V$FLASHBACK_DATABASE_LOGFILE,v$RESTORE_POINT|  


|


###   [4.4 可维可测设计](#44-特性性能点2)  

|视图名称|内容|
|:---|:---|
|V$FLASHBACK_DATABASE_LOG|flashback log最小SCN和时间、保留时间、flashback log file总大小等信息|
|V$FLASHBACK_DATABASE_LOGFILE|flashback log的文件名、序号、每个文件最早scn和时间、类型等信息|
|V$RESTORE_POINT|还原点信息|
|V$SYSSTAT|新增Flashback log writes和Flashback log write bytes字段|
|v$database|新增flashback_on字段，判断数据库闪回是否开启|


##   [5.未来规划](#5未来规划)  

1. flash database完成，可以将数据库以只读的方式打开检查是否是期望的结果；如果不是期望的结果可以关闭数据库后再recover数据库将回到初始状态，再次开启flashback database。(  **是否需要数据库支持open read only模式，待讨论确定)**
1. 支持共享集群
1. 支持表空间ddl闪回
1. 支持单机和集群的主备



Created by 张旭涛, last modified on 四月 18, 2024

# *概要设计-*    [https://pingcode.yasdb.com/pjm/items/661510d3fd997db58ad66147](https://pingcode.yasdb.com/pjm/items/661510d3fd997db58ad66147)    *?*    
  *#YMP-2130 使用备份集恢复支持从om获取恢复节点的ip*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#1-%E6%80%BB%E8%BF%B0)  

分布式备份需要备份节点的部署形态、节点ip、端口等详细部署配置，恢复时候可指定部署配置文件，支持修改原有部署ip节点。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

分布式认证需求

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

根据当前分布式备份恢复现状，此功能优化分布式备份集恢复的灵活性，无需调研。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|备份|备份分布式的节点部署形态、ip、port|是|是|
|功能|恢复|分布式恢复前指定分布式节点部署配置文件，按照配置文件部署模式恢复|是|是|
|功能|恢复|可随意修改节点的部署ip|是|是|
|性能|性能场景1|与原始分布式恢复性能一致|否|否|
|可用性|恢复场景|提高分布式恢复灵活性|是|是|
|易用性|恢复场景|提前配置好节点的部署ip和状态|是/否|是/否|


## 2.     [接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

###   [2.1 备份](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

备份：yasrman sys/sys@IP:port -c "backup cluster format '路径' tag ‘标签’" -D catalog路径   // 其中 format 执行备份集目录，tag 执行集群备份的唯一标签，IP port是CN的，  catalog是备份集元数据文件路径

  


###   [2.2 恢复](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


恢复：yasrman sys/sys@IP:port -c "restore cluster from tag ‘标签’"  -D catalog路径  // 恢复所有主机，同时build备机，tag 是备份集标签，IP port是CN的

若需要变更分布式节点ip、port。 需要执行yasbak命令生成节点ip、port信息文件，导入catalog中。

  


yasbak命令  

1. ./bin/yasbak reset -c cluster_name -p password -f  清理环境并拉起到nomount状态
1. yasbak run -c minidb -s "restore cluster from tag 'full_1'" yasbak执行restore命令之前导出分布式节点的配置信息，并把该文件configure导入catalog中。


执行以上两个步骤的yasbak恢复命令即可恢复分布式集群至open状态。 其中yasbak的第2条命令包含导出分布式节点信息至临时文件，并使用  **configure dstb_nodes ‘configpath’ **  导入catalog中。实现一步操作恢复。

临时文件的默认名为yasbak_nodeinfo_${集群名称} 在catalog主目录下

  


内部使用configure 命令导入配置文件    ** **  **configure dstb_nodes ‘configpath’；**

show all 可列出这个文本文件的配置路径。

  


```
[zhangxt@AchorBase ~]$ yasrman sys/Cod-2022@127.0.0.1:1688 -c "show all" -D /home/zhangxt/catalog
+---------------------------+-----------+----------------+
|           NAME            |  DEFAULT  |      VALUE     |
+---------------------------+-----------+----------------+
| PARALLELISM               | 2         | 5              |
| SECTION SIZE              | 134217728 | 134217728      |
| COMPRESSION ALGORITHM     | NONE      | NONE           |
| COMPRESSION LEVEL         | LOW       | LOW            |
| DEST                      | SERVER    | SERVER         |
| DSTB NODES                | ''        | /home/zhangxt/catalog/nodes |
+---------------------------+-----------+----------------+
```

  


###   [2.3 系统表新增接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


1. backupset$ 新增字段加密校验密钥， 字段名字待定（encry_hash）
1. backupset$ 新增字段BS_KEY标识唯一的备份集（为Uint32的值），单机、集群每个备份命令只生成一个独立的备份集，有自身独立的bskey。
    1. 分布式下一条备份命令，可在每个节点生成独立的备份集，每个备份集的bskey也不一致。
    1. yasrman端备份的可使用list 命令查看每个备份集的bskey。


  


backup_profile中新增字段BS_KEY 和base_BS_KEY,其中BS_KEY标识自身的唯一key，base_bs_key标识增量备份基线的bs_key，如果是全量备份该值为0.

###   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

  


1. 若是增量备份，增量备份期间不能做表空间迁移、扩容、缩容。比如先做level 0备份，然后执行扩缩容或者表空间迁移，然后无法继续再执行level 1备份。（以前未拦截，扩容的新节点找不到极限备份集自动报错，缩容无法检测到）
1. 相比较备份集的部署发生了扩容或者缩容。执行恢复前，需要将分布式的部署模式恢复至与备份时的部署模式一致。否则无法恢复。


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#4-%E7%89%B9%E6%80%A7)  

  


###   [4.1 特性设计（部署config文件）](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

导入的外部节点部署config文件格式

  


```
[zhangxt@AchorBase yashome]$ ./bin/yasboot package de gen --local --cluster minidb --mn 3 --cn 3 --dn 3-3  --data-path /data/shm/data --listen-cidr 0.0.0.0/0
 hostid   | group | node_type | node_name | listen_addr  | din_addr       | replication_addr | data_path     
--------------------------------------------------------------------------------------------------------------
 host0001 | mng1  | mn        | 1-1       | 0.0.0.0:1678 | 127.0.0.1:1679 | 127.0.0.1:1680   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | mng1  | mn        | 1-2       | 0.0.0.0:1681 | 127.0.0.1:1682 | 127.0.0.1:1683   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | mng1  | mn        | 1-3       | 0.0.0.0:1684 | 127.0.0.1:1685 | 127.0.0.1:1686   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | cng1  | cn        | 2-1       | 0.0.0.0:1688 | 127.0.0.1:1689 | 127.0.0.1:1690   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | cng1  | cn        | 2-2       | 0.0.0.0:1691 | 127.0.0.1:1692 | 127.0.0.1:1693   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | cng1  | cn        | 2-3       | 0.0.0.0:1694 | 127.0.0.1:1695 | 127.0.0.1:1696   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | dng1  | dn        | 3-1       | 0.0.0.0:1698 | 127.0.0.1:1699 | 127.0.0.1:1700   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | dng1  | dn        | 3-2       | 0.0.0.0:1701 | 127.0.0.1:1702 | 127.0.0.1:1703   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | dng1  | dn        | 3-3       | 0.0.0.0:1704 | 127.0.0.1:1705 | 127.0.0.1:1706   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | dng2  | dn        | 4-1       | 0.0.0.0:1707 | 127.0.0.1:1708 | 127.0.0.1:1709   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | dng2  | dn        | 4-2       | 0.0.0.0:1710 | 127.0.0.1:1711 | 127.0.0.1:1712   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | dng2  | dn        | 4-3       | 0.0.0.0:1713 | 127.0.0.1:1714 | 127.0.0.1:1715   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | dng3  | dn        | 5-1       | 0.0.0.0:1716 | 127.0.0.1:1717 | 127.0.0.1:1718   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | dng3  | dn        | 5-2       | 0.0.0.0:1719 | 127.0.0.1:1720 | 127.0.0.1:1721   | /data/shm/data
          +-------+-----------+-----------+--------------+----------------+------------------+----------------
          | dng3  | dn        | 5-3       | 0.0.0.0:1722 | 127.0.0.1:1723 | 127.0.0.1:1724   | /data/shm/data
----------+-------+-----------+-----------+--------------+----------------+------------------+----------------
```

  


```
[zhangxt@AchorBase ~]$ yasrman sys/Cod-2022@127.0.0.1:1688 -c "list backup tag 'dist33'" -D /home/zhangxt/catalog
Group: type DB, tag: dist33, format: bak_2024041115493683, connect url: 127.0.0.1:1688, nodeCount: 15, distribution: TRUE, isClient: FALSE, offset: 45056
  backupset ID: 0
    node 1-1, type MN, url 127.0.0.1:1678, role PRIMARY
    backup path: /data/shm/data/mn-1-1/backup/bak_2024041115493683 
  backupset ID: 0
    node 1-2, type MN, url 127.0.0.1:1681, role STANDBY
    backup path:  
  backupset ID: 0
    node 1-3, type MN, url 127.0.0.1:1684, role STANDBY
    backup path:  
  backupset ID: 3
    node 2-1, type CN, url 127.0.0.1:1688, role PRIMARY
    backup path: /data/shm/data/cn-2-1/backup/bak_2024041115493683 
  backupset ID: 4
    node 2-2, type CN, url 127.0.0.1:1691, role PRIMARY
    backup path: /data/shm/data/cn-2-2/backup/bak_2024041115493683 
  backupset ID: 5
    node 2-3, type CN, url 127.0.0.1:1694, role PRIMARY
    backup path: /data/shm/data/cn-2-3/backup/bak_2024041115493683 
  backupset ID: 6
    node 3-1, type DN, url 127.0.0.1:1698, role PRIMARY
    backup path: /data/shm/data/dn-3-1/backup/bak_2024041115493683 
  backupset ID: 0
    node 3-2, type DN, url 127.0.0.1:1701, role STANDBY
    backup path:  
  backupset ID: 0
    node 3-3, type DN, url 127.0.0.1:1704, role STANDBY
    backup path:  
  backupset ID: 9
    node 4-1, type DN, url 127.0.0.1:1707, role PRIMARY
    backup path: /data/shm/data/dn-4-1/backup/bak_2024041115493683 
  backupset ID: 0
    node 4-2, type DN, url 127.0.0.1:1710, role STANDBY
    backup path:  
  backupset ID: 0
    node 4-3, type DN, url 127.0.0.1:1713, role STANDBY
    backup path:  
  backupset ID: 12
    node 5-1, type DN, url 127.0.0.1:1716, role PRIMARY
    backup path: /data/shm/data/dn-5-1/backup/bak_2024041115493683 
  backupset ID: 0
    node 5-2, type DN, url 127.0.0.1:1719, role STANDBY
    backup path:  
  backupset ID: 0
    node 5-3, type DN, url 127.0.0.1:1722, role STANDBY
    backup path:
```

  


```
nodeCount=15 ，可选待考虑
node=1-1, type=MN, url=127.0.0.1:1678
node=1-2, type=MN, url=127.0.0.1:1681
node=1-3, type=MN, url=127.0.0.1:1684
node=2-1, type=CN, url=127.0.0.1:1688
node=2-2, type=CN, url=127.0.0.1:1691
node=2-3, type=CN, url=127.0.0.1:1694
node=3-1, type=DN, url=127.0.0.1:1698
node=3-2, type=DN, url=127.0.0.1:1701
node=3-3, type=DN, url=127.0.0.1:1704
node=4-1, type=DN, url=127.0.0.1:1707
node=4-2, type=DN, url=127.0.0.1:1710
node=4-3, type=DN, url=127.0.0.1:1713
node=5-1, type=DN, url=127.0.0.1:1716
node=5-2, type=DN, url=127.0.0.1:1719
node=5-3, type=DN, url=127.0.0.1:1722
```

  


要求：

1. 格式必须保证与示例统一，首行为节点个数，后续可新增可选项。
1. 其余内容依次为nodeid（节点的唯一标识），节点类型。两种可标识为备份前集群中节点的部署模式，配置文件中的nodeid和nodetype必须保证和备份集中完全匹配，且必须与实际的部署模式必须完全匹配。
    1.  配置文件和备份集中的不匹配，nodeid和节点类型发生变化，报错
    1. 实际部署的nodeid和节点类型不匹配，报错
    1. 备份集类型和节点类型不匹配，报错
1. url标识为更改后的节点ip，若内容无修改，需要保证与备份集中内容显示一致。若ip发生修改，节点迁移至一台全新的机器，也需要将原始的备份集迁移至新的机器，且路径必须保持和原来一致。
1. 主备状态与catalog备份集中记录的保持一致去恢复。
1. 若是增量备份，指定的备份路径必须是同一级别（incrementid、dbid、restoretime。当前字段还不足校验为分布式下的同一系列备份集。需要新增字段随机值），（密码、魔数放入系统表）
1. 若是发生节点的切换，需要将增量备份集的所有备份集拷贝至主机节点，否则就因找不到备份集而备份失败。


  


格式要求：

1. 首行必须是nodeCoun=count
1. 后续为 node=1-1，指定节点的groupid和nodeid，使用 = 指定， 使用英文逗号分隔。每一行只能为一个节点的配置项，中间不能有空行。
1. url设置完成之后 ，后续不能有其他字段。


  


解析方案：

1. 首行解析总的节点信息， 当前只有nodecount， 以逗号分隔
1. 其他节点的详细信息按行读取，按逗号分隔每个配置项，  以key=value的形式解析具体的配置项


###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)      [备份](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


备份与原始的分布式备份命令完全一致。

  


  


  


###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)      [恢复步骤一](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d66a1ad9a3311dc90ef/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc5NzksImV4cCI6MTc4MjMxODc3OX0.4K3As_wIoepQhh7_-prWu6SgwH5a-YwAt8d7Op6EsDY)

不管节点的ip是否发生变化，都需要导入配置文件

分布式端yasbak  reset拉起至nomount之后，执行yasbak 的restore命令自动获取配置文件并自动导入至catalog中。

**（配置文件不允许手动修改）**

  


###   [4.4 恢复步骤二](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

#### 校验：

1. 配置文件和备份集内容校验，校验（nodeid和nodetype）是否和备份集中的完全匹配，不多不少。
1. 连接校验，校验config文件的配置ip是否正常、可连接。主备连接是否正常。主备信息与备份集中记录的为准。且恢复后的主备状态与备份集中记录的完全一致。
1. 待恢复的所有节点的备份集校验，dbid、restoretime、incrementalid、（还需要新增字段标识属于同一类备份集）。 校验指定的备份集是否是当前节点的（CN必须是CN的备份集，nodeid是否错乱）
1. CN每个都是主机，其他每个group主机只能有一个。校验主备个数


#### 开始恢复：

1. 读取catalog中的文件文件，按照ip逐一连接恢复。
1. 与原始恢复逻辑一致，先恢复主节点
1. 主节点恢复完成之后，开始执行build建立所有备机。


#### 恢复完成。

  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

  


## Attachments:

## Comments:

|  [](null)  ,与会人：马志宏、张旭涛、施新华、董灵林,会议时间：2024.04.16    
  会议地点：线下会议,会议纪要：,1.yasbak需要命令支持到处配置文件,2.show all命令列出配置文件路径,Posted by zhangxutao at 四月 16, 2024 10:54|
|---|

Created by 陈瑞, last modified on 二月 22, 2024

# 1. 概述

yasrman目前只支持单机和分布式，需要yasrman支持集群备份恢复、备份集管理，使3种部署形态下的yasrman统一。

*详细设计-YDBRD-21614 : 集群支持rman 方案设计*

*IR链接：*    [[YDBRD-20221] 支持yasrman备份与备份集管理 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-20221)  

*SR链接：*    [[YDBRD-21614] yasrman工具支持集群 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21614)  

# 2. 需求分析

## 2.1 功能点分析

- 备份：在 server/client端，format指定普通磁盘/共享磁盘。备份在client 只能指定普通磁盘
- 恢复：在 server/client端，format指定普通磁盘/共享磁盘。恢复在client 只能指定普通磁盘
- 备份集查看+删除


  


备份语法图

![](https://pingcode.yasdb.com/atlas/files/public/67396bdb8970c2af4f52076d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFnQUFBQUFBQVFBQUFBQUFBQUFBSUFJQUFCQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUlBQUNBQUFBQUFDQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBSUFBQUFBZ0VDQUlBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc0MjIsImV4cCI6MTc4MjMwODIyMn0.XMJAIJCye7_NPCoDgAeKePquNizrqCP2xkne_rRibb8)

  


恢复语法图

  


![](https://pingcode.yasdb.com/atlas/files/public/67396bdb8970c2af4f52076e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFnQUFBQUFBQVFBQUFBQUFBQUFBSUFJQUFCQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUlBQUNBQUFBQUFDQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBSUFBQUFBZ0VDQUlBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc0MjIsImV4cCI6MTc4MjMwODIyMn0.XMJAIJCye7_NPCoDgAeKePquNizrqCP2xkne_rRibb8)

  


删除归档备份集

![](https://pingcode.yasdb.com/atlas/files/public/67396bdb8970c2af4f52076f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFnQUFBQUFBQVFBQUFBQUFBQUFBSUFJQUFCQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUlBQUNBQUFBQUFDQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBSUFBQUFBZ0VDQUlBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc0MjIsImV4cCI6MTc4MjMwODIyMn0.XMJAIJCye7_NPCoDgAeKePquNizrqCP2xkne_rRibb8)

### 查看备份集

![](https://pingcode.yasdb.com/atlas/files/public/67396bdb8970c2af4f520770/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFnQUFBQUFBQVFBQUFBQUFBQUFBSUFJQUFCQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUlBQUNBQUFBQUFDQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFCQUFDQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBSUFBQUFBZ0VDQUlBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc0MjIsImV4cCI6MTc4MjMwODIyMn0.XMJAIJCye7_NPCoDgAeKePquNizrqCP2xkne_rRibb8)

  


## 2.2 应用场景

- 备份恢复：支持远程备份和恢复，即备份集和数据库在不同服务器（备份集服务器需要安装工具）


- 管理：支持备份集的统计和删除


## 2.3 规格约束

- 备份目标数据库必须在open状态下。
- 恢复必须是master role节点，且必须是nomunt状态。
- server端可以指定备份路径为普通磁盘和YFS，client端只能指定普通磁盘。
- 备集群不支持备份


# 3. 详细测试设计

## 3.1 测试设计方法

1. yasrman备份命令语法验证：采用等价类划分法，针对语法进行覆盖，主要验证yasrman执行备份命令是否正常，报错是否明确
1. 备份恢复功能部分，采用场景法，异常场景采用错误推测法


*测试场景分析*

*1、备份+恢复语法校验*    
  *2、备份于 server + client 指定普通磁盘/共享磁盘 *

- 全量，增量，压缩，加密，并行度设置。主要测试整库备份，归档备份其他sr已覆盖
- 备份在client端。包括  *普通磁盘/yfs对应的正常/异常场景。*
- 备份在server端。  *普通磁盘/yfs，两种场景*
- xbsa 流式备份


*3、恢复 server端 + 远程恢复 指定普通磁盘/共享磁盘*    
  *4、pitr恢复*    
  *5、备份集删除+查看*    
  *6、yasrman ipv6*    
  *7、db不同模式下，备份/恢复。集群不同状态备份表现是否合理.冷备*    
  *8、集群并发和故障*

*动态视图：*  *v$process、dba_backup_set、v$backup_progress、v$recovery_progress*

*性能：*  *备份和恢复时间不高于yasql，对比yasql没有明显下降*

*安全：通过ps ux查看时要隐藏密码，日志和配置文件中不能有明文密*

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|是|
|DFR|否|
|HA|是|
|压力|否|
|性能|是|
|可维护性|否|


  


### 3.1 语法

|输入条件|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|
|yasrman|输入正确|大写，大小写混合|  
|
|  
|  
|写错yarman，rman，yasrmen等，报错|  
|
|  
|yasrman -v|  
|  
|
|  
|yasrman -h|  
|  
|
|yasrman   --help|帮助信息正确|  
|  
|
|用户名/密码|用户名和密码正确|用户名错误|参考yasql|
|  
|  
|密码错误|  
|
|  
|  
|用户名和密码都错误|  
|
|IP和端口|IP和端口正确|IPV4/IPV6正确，端口错误|  
|
|  
|  
|IPV4/IPV6和端口都错误|  
|
|  
|  
|IPV4/IPV6和端口格式不对，比如包含特殊字符，IP或端口为空|  
|
|  
|  
|IPV4/IPV6使用域名|ipv6 未自动化|
|  
|  
|yasrman sys/sys@127.0.0.1:1688，默认连本机，报错|  
|
|yasrman sys/sys@127.0.0.1:1688 -c "backup database format '/home/yashan/bak_1' dest clinet tag ‘bak1’" -D catalog|-c正常输入|--c报错|  
|
|  
|-C|--C报错|  
|
|  
|  
|-f报错|  
|
|  
|  
|-D报错|  
|
|  
|  
|-v 报错|  
|
|  
|  
|-V 报错|  
|
|  
|  
|-f -e报错|  
|
|备份语句|正常输入（需要覆盖所有的备份属性），使用双引号|使用括号|  
|
|  
|  
|备份语句为空或空串或单引号|  
|
|  
|  
|备份语句语法正确，但执行报错，比如format不存在，备份失败，残留的备份文件被清理,查视图，再去对应文件目录查看文件是否存在。|  
|
|  
|备份语句以分号结尾|不指定tag报错，和tag为空|  
|
|dest client/dest server|dest client，备份到工具侧所在机器|dest clinet，client写错|yasrman的默认备份集路径是catalog下的backup|
|  
|dest server，备份到远程数据库所在机器|dest serverice，server写错|默认在backup下|
|  
|缺省，默认是  server|  
|  
|
|  
|缺省，默认是  server，  指定yfs路径|  
|  
|
|  
|在backup database 后面|  
|  
|
|  
|dest client大写或大小写混合|dest client、dest server同时使用|  
|
|  
|dest server大写或大小写混合|在yasql中执行备份语句，指定  dest client/dest server报错|  
|
|  
|  
|相对位置错误|应该放在哪里？备份属性的最后面？——无位置要求|
|  
|dest server，备份指定yfs路径|dest client，备份指定yfs路径|  
|
|恢复语句|正常恢复：yasrman sys/sys@192.168.7.101:1688 -c "restore database from '/home/yashan/bak_1' dest client tag ‘bak1’" -D catalog|恢复语法正确，但路径不存在|必须有tag|
|  
|正常恢复：yasrman sys/sys@192.168.7.101:1688 -c "restore database from '/home/yashan/bak_1' dest server tag ‘bak1’" -D catalog|dest clinet报错|  
|
|  
|正常恢复：yasrman sys/sys@192.168.7.101:1688 -c "restore database from '/home/yashan/bak_1'  tag ‘bak1’" -D catalog|恢复语法正确，语句外面带dest client和dest server|  
|
|  
|使用单引号|使用括号|  
|
|  
|  
|恢复语句为空或空串|  
|
|  
|  
|恢复语句以分号结尾|  
|
|  
|  
|不指定tag，报错|  
|
|  
|  
|恢复语法错误|  
|
|  
|指定yfs的备份集|  
|功能覆盖|
|-D path|-D catalog正常输入|catalog不存在|  
|
|  
|不指定catalog，默认当前目录|-d|  
|
|  
|-D catalog缺省|catalog未创建|使用 yasrman -D nocatalog启动，在yasrman命令行执行yasrman -D create catalog  ‘path’； 手动创建|
|  
|路径带单引号和双引号|路径使用中文双引号|  
|
|  
|路径不带引号|路径为相对路径|  
|
|yasrman sys/Cod-2022@127.0.0.1:1688 -c 'create catalog' -D 'path' |正常输入|  
|yasrman sys/sys@IP:port -c "create catalog"  -D catalog路径|
|  
|path最长255  linux / yfs路径 31|path超过255  linux / yfs路径31|规格|
|  
|相对路径，默认是当前路径  （linux/yfs路径绝对路径）|path含特殊字符  （linux/yfs路径绝对路径）|  
|
|  
|绝对路径  （linux/yfs路径）|路径为空|  
|
|  
|不指定-D，默认是当前路径|路径不存在|  
|
|  
|create catalog  以分号结尾|-d|  
|
|  
|  
|yasrman不存在,  错别字或者写错yasql|  
|
|  
|  
|语法错误|  
|
|  
|  
|重复创建catalog报错|  
|
|  
|  
|不创建catalog，备份|  
|
|list backup|列出集群备份视图内容。每个备份集增加节点信息 ,不要文件细节|  
|1. 不包含yasql生成的备份集
1. yasql中能查到yasrman生成的备份集
1. 语法：yasrman sys/sys@IP:port -c "list backup"  -D catalog路径
,（冒烟用例）|
|  
|dba用户/sys用户（  有查看dba_backup_set视图的权限  ）|普通用户（没有查看  dba_backup_set的权限  ）查看为空|1. 权限未校验
1. 需要-c执行
|
|  
|linux/和yfs两种均有|  
|  
|
|list backup all   （没有这个语法）|列出catalog文件中记录的所有内容，过滤掉valid字段为false的内容，单机：groupinfo（nodeinfo+bakinfo）  分布式：groupinfo+（（nodeinfo+bakinfo）+（nodeinfo+bakinfo）+...）   ，显示的内容正确|  
|  
|
|list backup tag ‘tagid’ |列出tagid的备份集合信息（grouptag）|tagid不存在|yasrman sys/sys@IP:port -c "list backup tag ‘标签’"  -D catalog路径 |
|  
|tagid使用双引号|tagid使用括号|  
|
|list backup  nodeid（暂不支持）|  
|列出该node数据库的备份集内容    暂未实现，报错|  
|
|list failure（暂不支持）|  
|列出备份失败的条例|yasrman 支持的内容为 FailureID    TIME   Summary,列表信息清晰|
|CONFIGURE 语法|configure  PARALLELISM  （2,4,6,8）  #设置并行线程个数|0，9报错|-c "configure  PARALLELISM  （2,4,6,8）"|
|  
|configure  PARALLELISM  clear；  #取消设置|PARALLELISM写错，比如PARALLEL|配置文件catalog/config.ini|
|  
|configure   COMPRESSION ALGORITHM zstd|lz4  low； 相当于先设置压缩参数，并且打开压缩开关|其他压缩算法报错|  
|
|  
|  
|压缩等级写错，比入highest，报错|  
|
|  
|configure COMPRESSION ALGORITHM  clear；  //相当于先清除备份压缩配置参数恢复为默认，然后关闭压缩设置|  
|  
|
|  
|configure encryption ALGORITHM "[AES128/AES192/AES256/SM4]";|其他加密算法，报错|配置加密算法不支持|
|  
|  
|加密算法写错，报错|  
|
|  
|  
|设置密码报错|  
|
|  
|configure encryption ALGORITHM clear;  清除压缩算法配置，恢复成默认|  
|取消配置加密算法不支持|
|  
|configure   SECTION SIZE 128M;|127M报错|  
|
|  
|configure   SECTION SIZE 32T;|32.1T报错|  
|
|  
|configure SECTION SIZE clear；  清除分片文件大小，采用默认配置|  
|  
|
|  
|configure  dest server;   #default    备份在主机端|  
|该配置项需要记录在group内|
|  
|configure  dest client;     # 工具端|  
|  
|
|  
|configure dest clear； #清除远程服务器配置，变为default   |config clear；|  
|
|  
|各种属性全部配置，做备份，检查备份集配置与设置的一致|  
|  
|
|  
|各种属性全部配置，做备份时设置各项属性，检查备份集设置与实际一致|  
|  
|
|  
|清除属性配置后，执行备份，使用默认配置|  
|  
|
|  
|  
|  
|  
|
|show 语法|   show all；  查看所有的配置信息，  配置信息正确（与配置的一致）|shew all;|查看所有的配置信息，yasrman 命令行执行，不需要连接数据库，需要覆盖分布式|
|  
|-c执行‘show all’|show alls;|  
|
|  
|  
|show;|  
|
|delete 语法（  yasrman sys/sys@IP:port -c "delete backupset tag ‘标签’"  -D catalog路径  ）|DELETE BACKUPSET TAG 'XXX';，查看backupset$中的记录被删除|不指定catalog文件路径，报错|删除物理备份和副本，需要覆盖分布式|
|  
|  
|DELETE BACKUPSET all报错|  
|
|  
|  
|tag不存在，报错|  
|
|  
|  
|DELETE BACKUP all报错|  
|
|  
|  
|在备机上执行报错|  
|
|delete 语法（  yasrman sys/sys@IP:port -c "delete backupset path ‘路径’"  -D catalog路径  ）(暂不支持)|DELETE BACKUPSET path 'XXX';，查看backupset$中的记录被删除|  
|覆盖server端和client端的备份集,（冒烟用例）|
|  
|不指定catalog文件路径，默认当时路径|DELETE BACKUPSET all报错|  
|
|  
|  
|path不存在，报错|  
|
|  
|  
|DELETE BACKUP all报错|  
|
|  
|  
|在备机上执行报错|  
|
|backup database delete backupset语法（在yasql中执行）|backup database delete backupset tag ‘’,删除成功，删除后查询dba_backup_set中没有该记录，备份目录下没有该备份集，list backup中可能存在该记录|备份集不存在，报错|需要覆盖分布式    
  BACKUP DATABASE DELETE BACKUPSET TAG 'bakcup_1';    
  BACKUP DATABASE DELETE BACKUPSET PATH '/home/yasdb/backup/bakcup_1';    
    
|
|  
|backup database delete backupset path ‘’,删除成功，删除后查询dba_backup_set中存在该记录，备份目录下没有该备份集，list backup中可能存在该记录|路径不存在，报错|  
|
|  
|删除备份集后，再次做备份（备份语句，tag名称等和之前的一样）成功|语法错误，报错|  
|
|  
|  
|主备部署，在集群备机上执行2种删除语法报错|  
|


  


### 3.2 功能+异常场景

恢复后，各个节点校验数据

|  
|场景|测试场景|备注|
|---|---|:---|:---|
|1|备份恢复基础场景|使用yasrman对远程数据库做全量备份（到远程，指定YFS），带压缩带加密，备份后恢复到本地机器上，报错|语法校验|
|2|  
|使用yasrman对远程数据库做全量备份（到远程，指定YFS），带压缩带加密，备份后恢复到远程机器上，校验数据|（冒烟用例）|
|3|  
|使用yasrman对远程数据库做增量备份（到远程，指定YFS），带压缩带加密，备份后恢复到远程机器上，校验数据|（冒烟用例）|
|4|  
|使用yasrman对远程数据库做差量备份（到远程，指定YFS），带压缩带加密，备份后恢复到远程机器上，校验数据|（冒烟用例）|
|5|  
|~~使用yasrman对远程数据库做全量/增量/差量备份（到远程，指定linux路径），带压缩带加密，备份后恢复到本地机器上，校验数据~~|不存在该场景|
|6|  
|使用yasrman对远程数据库做全量/增量/差量备份（到远程，指定linux路径），带压缩带加密，备份后恢复到远程机器上，校验数据(备份和恢复必须在一台机器/增量备份集必须在一台机器)|  
|
|7|  
|使用yasrman对远程数据库做全量/增量/差量（到本地，指定YFS路径）报错|  
|
|8|  
|使用yasrman对远程数据库做全量/增量/差量备份（到本地，指定linux路径），带压缩带加密，备份后恢复到远程机器上（指定dest client），校验数据|全量备份|
|9|  
|使用yasrman对远程数据库做全量（到本地，指定linux路径），xbsa备份，带压缩带加密，备份后xbsa恢复到远程机器上，校验数据|  
|
|10|  
|增量/备份集备份在不同实例备份,恢复使用不同的实例不同的备份集，备份到yfs和linux(level 0 在共享盘)|05|
|11|xbsa 流式备份|使用yasrman对远程数据库做全量（到远程，指定YFS），xbsa备份，带压缩带加密，备份后xbsa恢复到远程机器上，校验数据|  
|
|12|  
|使用yasrman对远程数据库做全量（到远程，指定YFS），xbsa备份，带ssl，带压缩带加密，备份后xbsa恢复到远程机器上，校验数据，发送的包加密|未验证|
|13|*yasrman ipv6*|ipv6 使用yasrman对远程数据库做全量备份（到远程，指定YFS/linux），恢复到远程，校验数据|未验证|
|14|*备份集删除+查看*|*备份集删除+查看 ，以上场景交叉覆盖*|  
|
|15|*db不同模式/不同角色下备份恢复*|备份的远程数据库nomount/mount时执行备份，报错|07|
|16|  
|备份的远程数据库是open状态，其他节点是nomount/mount时执行备份，拦截（约束：三个节点必须都是open）,实例1 open，实例2 mount（完全mount），实例3 open时，实例1和实例2做备份报错    
,实例1 open，实例3 nomount，实例2 open时，实例1和实例2做备份报错|07|
|17|  
|停止某个节点，在其他节点做备份|13|
|18|  
|备份的数据库是备机（主备部署），报错。|  
|
|19|  
|~~备份数据库（到远程，指定YFS），~~  ~~server 端YFS未拉起（yfs未拉起，db退出），报错~~|不存在该场景|
|20|  
|~~备份数据库（到远程，指定YFS），~~  ~~client 端~~  ~~YFS未拉起，~~  ~~备份正常？~~|  
|
|21|  
|~~备份数据库（到远程，指定YFS），client/server 端YFS未拉起，~~  ~~备份正常？~~|  
|
|22|  
|~~恢复数据库（到远程，指定YFS），server 端YFS未拉起，报错~~|  
|
|23|  
|~~恢复数据库（到远程，指定YFS），client 端YFS未拉起，恢复~~  ~~正常？~~|  
|
|24|  
|~~恢复数据库（到远程，指定YFS），client/server 端YFS未拉起，恢复~~  ~~正常？~~|  
|
|25|  
|恢复的数据库是  集群NORMAL_ROLE节点  ，报错|  
|
|26|  
|节点是非0号实例，恢复的数据库是集群master_ROLE节点，正常|在N2,N3 上的其他场景已覆盖|
|27|  
|恢复的数据库是mount/open状态，报错|  
|
|28|  
|恢复的数据库节点是nomount，其他节点open/mount状态报错|08|
|29|  
|恢复是mv 基线备份集，恢复报错|+++09|
|30|  
|集群对应dbfiles 下有残留文件|集群对应dbfiles 下有残留文件|
|31|*集群并发和故障*|集群下，远程数据库不带归档，yasrman备份报错|10|
|32|  
|集群下，远程数据库正在做  备份（db/归档），  yasrman备份报错|11|
|33|  
|正在执行远程备份时，shutdown其他节点数据库，yasrman备份报错|12|
|34|  
|正在执行远程恢复时，shutdown其他节点数据库，yasrman恢复正常；shut down备份节点，备份可能报错，可能成功|13|
|35|  
|~~主备部署下，远程主机switchover时，给远程主机做备份报错，连不上远程主机~~|不支持sw|
|36|  
|ddl/dml业务背景，远程备份。|14|
|37|  
|备份失败，无残留备份集（list和文件均无）。|增加场景,测试观察点：通过yasql 查询 ,dba_backup_set 和 yasrman -c "list backup"查询|
|38|网络，磁盘等异常场景|YFS/linux磁盘空间不足时，备份失败|24 不上CI|
|39|  
|通过yasrman连接多个远程数据库（不同节点）做备份，同时备份失败，依次备份成功|其他用例|
|40|  
|yasrman给集群1备份，恢复到集群2，成功.数据校验成功|手工测试|
|41|  
|单机的备份集去恢复集群的库，报错（集群不支持的功能什么表现）|手工测试|
|42|  
|集群的备份集去恢复单机的库，报错|手工测试|
|43|  
|集群的备份集去恢复分布式的库，报错|手工测试|
|44|*pitr恢复*|yasrman 使用linux/yfs路径，指定pitr恢复，指定正确的scn/time，各节点校验数据|15|
|45|  
|归档文件copy到yfs路径，pitr恢复指定到正确的scn/time，恢复成功，校验数据|待补充|
|46|增量备份和yasql备份恢复结合|在本地直接给远程数据库做level 1的增量备份（yasql已执行过level 0的全增量备份），备份成功，yasrman恢复到本地或者远程报错，yasql恢复成功（备份集要完整）|  
|
|47|  
|远程备份执行时，在yasql中执行  backup database cancel，备份报错|待补充|
|48|  
|远程备份后，在yasql中执行  backup database delete backupset删除指定的备份集，在yasrman中查询不到该备份集|  
|
|49|yasrman和其他操作|单机下，数据库正在创建/删除文件时，远程备份报错|14|
|50|  
|创建catalog文件前，做备份恢复报错|sql已覆盖|
|51|  
|指定confige，配置参数验证是否生效|  
|
|52|  
|指定confige，接口指定参数，优先级：接口>配置参数验证是否生效|19|


性能：

|备份/恢复linux路径|指标300M/s  |
|---|---|
|备份恢复yfs路径|指标300M/s  |
|ssl 流式备份|指标300M/s  |
|流式备份|指标300M/s  |


testkill：

|1. 视图查询：gv$archived_log、v$archived_log、v$table_dictionary、select OBJECT_ID,NAME,ref_count from v$dict_cache where ref_count is not null and ref_count!=0; v$backup_progress, dba_backup_set,2. 归档生成：alter system archive log current、alter system switch logfile、alter system checkpoint,3. 归档文件删除,4. 增删redo——这个暂时不支持，用例可以先写,5. 增删表空间，数据文件,6. ddl、dml业务—业务量要大一些,7. yasrman执行各种类型的db备份、归档备份，并发量大一些,8. 备份集删除,9.取消备份|
|---|


  


# 4. 测试用例

# 5. 测试框架设计

- *ha_regress*
- *yasft*
- *testkill*


# 6. 测试环境说明

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|集群2节点/集群主备|


# 7. 工作量评估

工作量：14  *人天*

计划测试完成时间：01/31

## Attachments:

[文本用例模板.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGFhMWFkOWEzMzExZGM4NWRiIiwicmVmX2lkIjoiNjczOTZiZGE3MjgyMDZlZmI5MmYwYWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NDIyLCJleHAiOjE3ODIzODM4MjJ9.Ln3eiuBPR54EBa7Yo_PwBwoMK5XGirYnmcKFmewucAc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[文本用例模板.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGFhMWFkOWEzMzExZGM4NWRjIiwicmVmX2lkIjoiNjczOTZiZGE3MjgyMDZlZmI5MmYwYWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NDIyLCJleHAiOjE3ODIzODM4MjJ9.sp6ucGfT-ouNtcNokGrGiwypXsDmtdhwLFMqy1YjaoQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-1-23_15-39-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGJhMWFkOWEzMzExZGM4NWRmIiwicmVmX2lkIjoiNjczOTZiZGE3MjgyMDZlZmI5MmYwYWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NDIyLCJleHAiOjE3ODIzODM4MjJ9.aoKf4iFyP22gQNW2vKnnkp4eN-vtye4UbxYBxbGzTJU)

 (image/png)    


[image2024-1-27_17-57-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGI4OTcwYzJhZjRmNTIwNzZjIiwicmVmX2lkIjoiNjczOTZiZGE3MjgyMDZlZmI5MmYwYWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NDIyLCJleHAiOjE3ODIzODM4MjJ9.0R5vclFsCZXuBt18k0mOZgEgDPWj-lGYnJB1Hz1Vqv8)

 (image/png)    


[集群支持yasrman.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGJhMWFkOWEzMzExZGM4NWUwIiwicmVmX2lkIjoiNjczOTZiZGE3MjgyMDZlZmI5MmYwYWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NDIyLCJleHAiOjE3ODIzODM4MjJ9.210jI1DvJcKXIwMQy_WzBRGN1jq26EaafAB4vAYy6j0)

 (application/vnd.ms-excel)    


[集群支持yasrman.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGJhMWFkOWEzMzExZGM4NWUxIiwicmVmX2lkIjoiNjczOTZiZGE3MjgyMDZlZmI5MmYwYWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NDIyLCJleHAiOjE3ODIzODM4MjJ9.glN2JnlYCe_4PviLjqutSEQkmkUgOQgeIpAKwbKV5PU)

 (application/vnd.ms-excel)    

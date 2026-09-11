Created by 张旭涛, last modified on 一月 19, 2024

# YDBRD-21614:     [YDBRD-21614](https://jira.yasdb.com/browse/YDBRD-21614?src=confmacro)    -  yasrman工具支持集群  完成

  


*详细设计-YDBRD-21614 : 集群支持rman 方案设计*

* IR链接：*    [[YDBRD-20221] 支持yasrman备份与备份集管理 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-20221)  

*SR链接：*    [[YDBRD-21614] yasrman工具支持集群 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21614)  

  


##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#1-%E6%80%BB%E8%BF%B0)  

yasrman目前只支持单机和分布式，需要yasrman支持集群备份恢复、备份集管理，使3种部署形态下的yasrman统一。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

华润数科产品化需求

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

 oracle支持catalog备份集校验、备份集元数据同步等。当前yashdb与oracle实现不同。参考后续详细设计。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|集群支持rman|复用单机备份恢复逻辑|是|是|
|性能|本地备份和远程备份性能比较|参考原始yasql在集群端备份逻辑|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**无**

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#2-%E6%8E%A5%E5%8F%A3)  

  


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|yasrman 备份语法|----|是|
|SQL语法|yasrman 恢复语法|----|是|
|SQL语法|yasrman删除备份集语法|  
|  
|


## 备份语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396ca38970c2af4f520d7f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBSUNBQUFDQUFBQUFBQVFBQUFBQUVBQUFBQUFBQVFBQUFBQUFBSUFBQUFBQUFRQUFBQUFBQkFBQWdDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQkFBQUFnQ0FBQUFBQUFBQUFCQUFBQUFBQkFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwNjYsImV4cCI6MTc4MjMxMjg2Nn0.TsbyoapuPK80cbWbmhpmivmUn9Y7tlD82_uX_Q4Fbts)

  


恢复语法图

  


![](https://pingcode.yasdb.com/atlas/files/public/67396ca38970c2af4f520d80/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBSUNBQUFDQUFBQUFBQVFBQUFBQUVBQUFBQUFBQVFBQUFBQUFBSUFBQUFBQUFRQUFBQUFBQkFBQWdDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQkFBQUFnQ0FBQUFBQUFBQUFCQUFBQUFBQkFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwNjYsImV4cCI6MTc4MjMxMjg2Nn0.TsbyoapuPK80cbWbmhpmivmUn9Y7tlD82_uX_Q4Fbts)

  


删除归档备份集

![](https://pingcode.yasdb.com/atlas/files/public/67396ca3a1ad9a3311dc8bef/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBSUNBQUFDQUFBQUFBQVFBQUFBQUVBQUFBQUFBQVFBQUFBQUFBSUFBQUFBQUFRQUFBQUFBQkFBQWdDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQkFBQUFnQ0FBQUFBQUFBQUFCQUFBQUFBQkFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwNjYsImV4cCI6MTc4MjMxMjg2Nn0.TsbyoapuPK80cbWbmhpmivmUn9Y7tlD82_uX_Q4Fbts)

  


list 查看备份集

![](https://pingcode.yasdb.com/atlas/files/public/67396ca38970c2af4f520d81/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBSUNBQUFDQUFBQUFBQVFBQUFBQUVBQUFBQUFBQVFBQUFBQUFBSUFBQUFBQUFRQUFBQUFBQkFBQWdDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQkFBQUFnQ0FBQUFBQUFBQUFCQUFBQUFBQkFBQUFBQUFBQUNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwNjYsImV4cCI6MTc4MjMxMjg2Nn0.TsbyoapuPK80cbWbmhpmivmUn9Y7tlD82_uX_Q4Fbts)

  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

  


1.备份目标数据库必须在open状态下。

2.恢复必须是master role节点，且必须是nomunt状态。

3.server端可以指定备份路径为普通磁盘和YFS，client端只能指定普通磁盘。

3.备集群不支持备份

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#4-%E7%89%B9%E6%80%A7)  

1. rman 支持集群本地和远程备份恢复，xbsa。
1. 支持集群的备份集管理，支持查看、删除。


###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

  


###   [4.2 特性功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    1

**备份**

backup database format ‘’ dest 

备份至client端： 

db端的备份逻辑同单机db，远程发送备份集文件复用单机逻辑，format只能指定普通磁盘。

  


  


备份至server端：

rman端发起备份指令之后。db端指定备份流程。执行结束后返回给rman备份成功的ack

format可以指定普通磁盘或者共享磁盘

  


xbsa同单机操作

###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

**恢复**

远程恢复：

同单机的恢复逻辑，由db端请求文件。rman端发送文件。校验format 不为yfs路径。

  


server端恢复：

若备份集在yfs端存储，db直接访问yfs备份集文件夹获取备份集文件。 需保证yfs进程正常拉起，可正常访问。

  


xbsa同单机操作

  


###   [4.3 特性功能点3](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

**备份集删除（归档备份已经部分支持）**

  


rman： delete backup set tag

保持和单机一致的语法，同时删除catalog和数据库系统表（db和arch）的内容。删除对应的备份集文件。

  


yasql： backup database delete backupset tag ‘tagname’。  删除db系统表、归档备份系统表、和备份集文件。

  


###   [4.4特性功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    4

**备份集查看：**

rman ：  list backup

相比较单机之外的内容， 列出集群实际节点个数。（每个节点的归档日志范围）

  


集群支持rman 的PITR

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

备份：

$ yasrman sys/sys@192.168.1.2:1688 -c "backup database tag 'full_1' format 'full_bak_1'" -D /home/yashan/catalog

$ yasrman sys/sys@192.168.1.2:1688 -c "backup database incremental level 0 compression encryption aes128 identified by 123456 format 'incr_base' tag 'incr_base' dest server;" -D /home/yashan/catalog    
  $ yasrman sys/sys@192.168.1.2:1688 -c "backup database incremental level 1 compression algorithm lz4 encryption aes128 identified by 123456 format 'incr_1' tag 'incr_1' dest server;" -D /home/yashan/catalog    
  $ yasrman sys/sys@192.168.1.2:1688 -c "backup archivelog all tag 'arch_all' format 'arch_all'" -D /home/yashan/catalog    
  $ yasrman sys/sys@192.168.1.2:1688 -c "backup archivelog sequence between 10 and 20 tag 'sequence_10_20' format 'sequence_10_20'" -D /home/yashan/catalog

  


恢复

$ yasrman sys/sys@192.168.1.2:1688 -c "restore database from tag 'full_1'" -D /home/yashan/catalog

$ yasrman sys/sys@192.168.1.2:1688 -c "restore archivelog all " -D /home/yashan/catalog    
  $ yasrman sys/sys@192.168.1.2:1688 -c "restore archivelog sequence between 10 and 20" -D /home/yashan/catalog

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

1. yasrman 文档新增支持集群备份恢复的约束。
1. 去掉原始yasrman的集群相关约束说明。


##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=141579978#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-1-19_18-11-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYTNhMWFkOWEzMzExZGM4YmVkIiwicmVmX2lkIjoiNjczOTZjYTM3MjgyMDZlZmI5MmYxNTBiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyMDY2LCJleHAiOjE3ODIzODg0NjZ9.PuuAb1CdWIiYh5NxCWzD2uK_gVUqkol1OZKvTNI_AOQ)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要：,与会人：马志宏、张旭涛、朱国旭、高亚宁、张彩虹、陈瑞    
  评审时间：2024.1.12  10:00    
  评审地点：西安会议室1    
  评审纪要信息：,1. yasrman的语法设计合理，通过。
1. 规格约束合理
,  
  评审通过与否：通过,Posted by zhangxutao at 一月 15, 2024 20:14|
|---|

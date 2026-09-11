## **1.需求概述：**

dba_data_files和dba_tablespaces视图字段对齐ORACLE

# 1.1   **需求来源**

SR链接：

  [https://pingcode.yasdb.com/pjm/items/67052053e489dd0868f22086?](https://pingcode.yasdb.com/pjm/items/67073fdce489dd0868f36fa9?)  

#YDBRD-33762 dba_data_files和dba_tablespaces视图字段对齐ORACLE

开发设计文档链接：  [https://pingcode.yasdb.com/wiki/pages/6749691ed2baff0fd558b730](https://pingcode.yasdb.com/pjm/items/67073fdce489dd0868f36fa9?)  

#YDBRD-33762 dba_data_files和dba_tablespaces视图字段对齐ORACLE

需求场景来源：

1.  /*NDTM*/SELECT a .tablespace_name,a .block_size,c .auexten,round(nvl(b.used_size, 0) / 1024 / 1024, 2) AS used_space,c .sum_blocks AS allocated_blocks,round(c .sum_space / 1024 / 1024, 2) AS allocated_space,round((c .sum_space - nvl(b.used_size, 0)) / 1024 / 1024, 2) AS allocated_free_space,round(nvl(b.used_size, 0) / c .sum_space * 100, 2) AS allocated_space_rate,c .sum_maxblocks AS max_usable_blocks,round(c .sum_maxspace / 1024 / 1024, 2) AS max_usable_space,round((c .sum_maxspace - nvl(b.used_size, 0)) / 1024 / 1024, 2) AS max_free_usable_space,round(nvl(b.used_size, 0) / c .sum_maxspace * 100, 2) AS used_rate_alert,a .contents,c .status,a .bigfile FROM dba_tablespaces a LEFT JOIN (SELECT tablespace_name,SUM(bytes) used_size FROM DBA_SEGMENTS WHERE segment_name NOT LIKE 'BIN$%' GROUP BY tablespace_name) b ON a .tablespace_name = b.tablespace_name LEFT JOIN (SELECT tablespace_name,min(online_status) AS status,round(sum(nvl(bytes, 0)), 2) AS sum_space,round(sum(nvl(blocks, 0)), 2) AS sum_blocks,DECODE(SUM(DECODE(autoextensible, 'NO', 0, 1)),0,'NO','YES') AS auexten,sum(case autoextensible when 'YES' then maxblocks else blocks end) AS sum_maxblocks,sum(case autoextensible when 'YES' then maxbytes else bytes end) AS sum_maxspace FROM dba_data_files GROUP BY tablespace_name) c ON a .tablespace_name = c .tablespace_name WHERE a .contents = 'PERMANENT' ORDER BY 1
1. /*NDTM*/ SELECT D.INST_ID, D.NAME NAME, F.PHYRDS, F.PHYBLKRD, F.PHYWRTS, F.PHYBLKWRT, F.READTIM * 10 as READTIM, F.WRITETIM * 10 as WRITETIM FROM GV$FILESTAT F, GV$DATAFILE D WHERE F.FILE# = D.FILE# AND F.INST_ID = D.INST_ID ORDER BY F.PHYRDS DESC, F.PHYWRTS DESC


需求范围：

单机、分布式和集群

需求规格：

dba_data_files视图支持autoextensible字段，已存在AUTO_EXTEND

dba_data_files视图支持online_status字段，已存在status

dba_tablespaces视图支持bigfile字段

支持GV$FILESTAT视图，包含V$FILESTAT  
交付版本：

23.4



# 2   **需求分析**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|根据需要补充动态视图的字段|1. 视图的字段名跟Oracle保持一致。
|是|是|
|功能|新增v$filestat视图|同Oracle的字段定义保持一致|是|是|


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|DBA视图|dba_data_files视图支持autoextensible、online_status字段|autoextensible  ：同  AUTO_EXTEND，YES等价于ON，NO等价于OFF,online_status  ：同status，内容保持一致。|是|
|DBA视图|dba_tablespaces视图支持bigfile字段|该字段仅用于Oracle兼容，值为NO|是|




# **3. 测试设计方法**

**(1). 视图字段的正确性，使用场景法和错误推测法设计**

**(2). 覆盖单机、集群、分布式三种部署形态**

**(3). DFX覆盖升级+HA场景**



### 3.1 DFX覆盖：

|系统级DFX分类|是否涉及|备注|
|:---|:---|:---|
|CT|N|  
|
|KT|N|  
|
|长稳|N|  
|
|一致性|N|  
|
|三方测试工具    
  (sqltest，sqlancer)|N|  
|
|安全|N|  
|
|DFR|N|  
|
|HA|Y|  
|
|压力|N|  
|
|性能|N|  
|
|可维护性|N|  
|
|升级|Y|  
|
|资料|Y|  
|


# **4. 详细测试设计**

|视图需求|部署形态|测试场景|预期|备注|
|---|---|---|---|---|
|dba_data_files，dba_tablespace |单机|使用不同方法查询视图：desc，  （select 不带filter、带filter、group by、join、子查询、having、distinct、order by、limit)|查询成功，字段定义正确，字段不缺失，无错别字|  
|
|  
|  
|在单机形态下，查视图结构,dba_data_files,dba_tablespace |查询成功，字段定义正确，字段不缺失|  
|
|  
|  
|视图权限交互创建普通用户查询视图|非DBA权限查询用户失败|  
|
|||表空间默认数据文件，建表，插数据，shrink tablespace|查询DBA_DATA_FILES视图AUTOEXTENSIBLE默认ONLINE   ，  ONLINE_STATUS与STATUS相同返回YES,dba_tablespace bigfile默认值NO||
|||表空间新增数据文件，插数据|查询DBA_DATA_FILES视图AUTOEXTENSIBLE默认ONLINE   ，  ONLINE_STATUS与STATUS相同返回YES,dba_tablespace bigfile默认值NO||
|||表空间设置自动扩展 10M，往表空间插入大量数据超过表空间初始大小,|查询dba_data_files视图 ，拓展成功||
|||表空间修改OFFLINE    |AUTOEXTENSIBLE返回NO AUTOEXTENSIBLE返回OFFLINE,dba_tablespace bigfile默认值NO||
|  
|HA|主备环境下，备机查询视图，备升主后，旧主查询视图,  
|主备查询DBA_DATA_FILES视图AUTOEXTENSIBLE默认ONLINE   ，  ONLINE_STATUS与STATUS相同返回YES,|  
|
|  
|集群|覆盖单机以上场景|查询视图状态正常，视图定义正常 无错别字|  
|
|  
|分布式|覆盖单机以上场景|查询视图状态正常，视图定义正常 无错别字|  
|


# **5.测试框架设计**

**功能用例添加到YTP平台上**

**DFX用例分别添加到yasft_dfx以及yasft仓上**

# **6.测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|LIUNX|
|部署|单机、分布式、集群|


# 


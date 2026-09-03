Created by 谢锐, last modified on 一月 18, 2024

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#1-overview概述)  

*说明本设计方案的背景、需求。*

*LSC冷数据粒度大，修改少，非常适合使用对象存储来存储。*

*云数仓，存算分离架构已成为数仓的主流架构，LSC急需补齐该能力。*

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#2-features功能特性)  

*说明本方案的功能特性。*

- DDL支持S3 bucket
- S3 bucket自动切换
- coast 支持S3 data bucket
- 支持创建cache tablespace，以及启用diskcache。
- 支持设置bucket readonly，禁止写入。（新功能）
- 支持启用/关闭diskCache
- 支持视图，以及统计信息，miner适配等
- 支持按照记录数来启用diskCache。（新功能）
- 支持根据hint来控制语句使用memcache, diskcache或不使用cache。（新功能）


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#3-interfaces接口)  

*列出本方案对外提供的接口、配置参数、API等。*

1,  data bucket相关ddl

2,  支持cache tablespace

3,  配置项SCOL_DISK_CACHEABLE_SCAN_ROWS

4，配置项ENABLE_DISKCACHE

5，设置bucket readonly/readwrite



##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#4-limitations功能限制)  

*说明本方案对外的功能限制或约束。*

*1，删除cache tablespace之前需disable diskcache。*

*2，cache tablespace给diskcache专用，不能在其上建表等。*

*3，系统最大支持512个 buckets。*

*4，目前S3 bucket仅支持path style，以及http协议。且url只能指定到bucket，不能为bucket下的目录。*

*5，暂不支持分布式。*

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#5-detail-design详细设计)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#51-architecture架构)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

  


##   

![](https://pingcode.yasdb.com/atlas/files/public/67396afda1ad9a3311dc7ef4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFDQUFBQUFRQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBSTRRQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFJQUlnQVFBQUFBQUFBQUFBRUFBQUFBUUFBQUFBQUFRQUlBQUFBQUFBZ0FJQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1MDgsImV4cCI6MTc4MjMwMTMwOH0.1uPD-FIFcx8sGIYEIaf-DniJ0DhkdzzFGO1uJglhCr4)

相对当前coast架构，调整如上图所示。

写流程类似，写过程不会涉及diskCache。

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#52-data-structures--flow数据结构与流程)  

*设计主要数据结构、工作流程、序列图等。*

  


#### Data bucket语法

= ADD DATABUCKET (bucket_clause {"," bucket_clause}) |

DROP DATABUCKET "'bucket_name'" |

ALTER DATABUCKET "'bucket_name'" (READONLY | READWRITE).

![](https://pingcode.yasdb.com/atlas/files/public/67396afd8970c2af4f52007e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFDQUFBQUFRQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBSTRRQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFJQUlnQVFBQUFBQUFBQUFBRUFBQUFBUUFBQUFBQUFRQUlBQUFBQUFBZ0FJQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1MDgsImV4cCI6MTc4MjMwMTMwOH0.1uPD-FIFcx8sGIYEIaf-DniJ0DhkdzzFGO1uJglhCr4)

bucket_clause = "'bucket_name'" [s3_bucket_clause] [MAXSIZE size_clause].

![](https://pingcode.yasdb.com/atlas/files/public/67396afd8970c2af4f52007f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFDQUFBQUFRQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBSTRRQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFJQUlnQVFBQUFBQUFBQUFBRUFBQUFBUUFBQUFBQUFRQUlBQUFBQUFBZ0FJQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1MDgsImV4cCI6MTc4MjMwMTMwOH0.1uPD-FIFcx8sGIYEIaf-DniJ0DhkdzzFGO1uJglhCr4)

size可以是字节数，也可以是unlimited。

s3_bucket_clause = S3 "(" URL "'url'" ["," REGION "'region'"] "," ACCESS KEY "'ak'" "," SECRET KEY "'sk'" ")".

![](https://pingcode.yasdb.com/atlas/files/public/67396afda1ad9a3311dc7ef5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFDQUFBQUFRQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBSTRRQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFJQUlnQVFBQUFBQUFBQUFBRUFBQUFBUUFBQUFBQUFRQUlBQUFBQUFBZ0FJQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1MDgsImV4cCI6MTc4MjMwMTMwOH0.1uPD-FIFcx8sGIYEIaf-DniJ0DhkdzzFGO1uJglhCr4)

URL最大1023字节，AK最大127字节，SK最大127字节，region最大127字节， region可省略。

URL中包含s3 bucket名称，最大127字节。

例如： CREATE TABLESPACE s3_tablespace DATABUCKET 's3_bucket3' S3(url '192.168.7.202:8000/testbucket',access key 'mos',secret key 'mos');

  


注意这里URL仅支持path-style，且必须对应于S3的某个bucket，而不能是一个prefix。

实际生成的对象路径是： url/tablespaceName/dataOid/sliceFileId。

#### DataBucket系统表

  


CREATE TABLE DATABUCKET$

(

TS# BINARY_INTEGER NOT NULL,

ID  BINARY_INTEGER NOT NULL,

TYPE BINARY_INTEGER NOT NULL,

USED_SIZE BINARY_BIGINT NOT NULL,

MAX_SIZE BINARY_BIGINT NOT NULL,

URL VARCHAR(1024) NOT NULL,

REGION VARCHAR(128),

ACCOUNT VARCHAR(128),

PASSWORD VARCHAR(128),

READONLY BOOLEAN NOT NULL

)SYSTEM 164 ORGANIZATION HEAP

/

CREATE UNIQUE INDEX I_DATABUCKET ON DATABUCKET$$(TS#, NAME)

  


1，升级时已创建的bucket不在该系统表中，系统保持兼容性。

2，user表空间默认创建的bucket不在该系统表中。即表空间仍然作为版本0创建。

3，name保证表空间内唯一。

  


#### Space/Bucket管理

data bucket有max size限制，但是这与S3的空间管理相差较大。

S3服务有的不提供使用量查询，有的能支持。 如OSS支持获取bucket下的对象数量以及空间占用。

公有云通常不支持bucket配额。

在分布式下，同一个表的不同chunk space通常使用一个s3 bucket，从而简化管理。

即用户或许无法给出size限制。这时如需要干预，只能通过disbale bucket命令禁止写入。

##   

![](https://pingcode.yasdb.com/atlas/files/public/67396afda1ad9a3311dc7ef6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFDQUFBQUFRQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBSTRRQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFJQUlnQVFBQUFBQUFBQUFBRUFBQUFBUUFBQUFBQUFRQUlBQUFBQUFBZ0FJQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1MDgsImV4cCI6MTc4MjMwMTMwOH0.1uPD-FIFcx8sGIYEIaf-DniJ0DhkdzzFGO1uJglhCr4)

spcGetAvlDataBucketId时做2个检查：

1，排除已经满的data bucket。

2，排除禁止写入的data bucket。禁止写入可以通过命令控制。

2，如果是s3 bucket，排除当前无法连接的bucket。

如果仍然无法选出可用bucket，则报错。

  


S3 bucket数据不复制，不参与备份，恢复。

  


1，到底哪些地方与路径相关
哪些地方需要路径转换，实际凡是涉及本地操作都需要
注意主备角色是变化的，不能简单的根据主备角色来判断是否做路径转换。
哪些地方需要获取真实路径，同样如此，除了下面目录内的备份文件名是非full name情况，因为写入也用相对路径，因而这里不能转为full name。
  

2，mount时机。
不能在open之后。否则主备切换仅mount情况下，bucket信息未加载。
所以这里分两阶段加载，s3需要访问系统表，在mount之后加载。
见问题    [https://jira.yasdb.com/browse/YDBRD-17373?filter=-1](https://jira.yasdb.com/browse/YDBRD-17373?filter=-1)  
  

3，bak目录下的文件使用的是相对路径。
这时只能调用convert，不能调用get real name。参考rstCreateDbFile中对于路径的转换。
  

4， MIGRATE下备份也可以使用绝对路径，目录下的文件使用相对路径。只要恢复时，将绝对路径同样进行转换即可。
MIGRATE下最好禁用绝对路径，否则搬动时很可能有问题。
  

5，无论哪个节点ctrl中记录的都是自己的实际路径。
    否则会有如下问题：1， 主备切换后alter/drop命令只能转为自己的本地路径。
                                      2，迁移到其他节点后，其他节点在系统表中的路径必需也是可以转换的。
    即进来的任何数据路径需转为本地。
  


  


  


#### S3库

在aws cpp s3基础上做了C封装，作为第三方库动态加载的方式给yashandb使用。

TODO：

暴露更多的S3参数供上层调整，比如最大重连次数，最大并发数等。

  


#### DiskCache

DiskCache空间管理以及内部结构设计参考    [DiskCache底座](https://conf.yasdb.com/pages/viewpage.action?pageId=91760531)    。

其常驻内存分配来自SCOL DATA BUFFER。

对象的压缩，加密对于diskCache是透明的，diskCache上的对象与存储池中保持一致。

DiskCache启用策略：

1，通过SCOL_DISK_CACHEABLE_SCAN_ROWS控制扫描是否使用diskCache

     建议该值比SCOL_CACHEABLE_SCAN_ROWS大，否则总是优先使用memCache。

2，仅针对S3等 remote storage pool启用。

3，支持memCache与diskCache联动，memCache hot LRU淘汰出来的对象会写入diskCache。

  


DiskCache淘汰策略：Region粒度的LRU。

  


##### DiskCache内存使用量计算

diskCache Index， 256*128K ，32MB

diskCache Region Metadata，每个region占用一个页面，一个group也占用一个页面。

一个group的总内存：((dbBlockSize - sizeof(DiskCacheRegionMeta)) / sizeof(DiskCacheItemMeta)) * block size，约为16MB。

  


#### DiskCache视图

v$diskcache

REGION_ID

RGION_GROUP_ID

REGION_HIT

ITEM_NUM

展示region基本信息。暂未提供分布式下视图。systat视图提供了diskCache统计信息。

  


v$diskcache_detail(TODO)

展示diskcache缓存对象详细信息。

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#53-compatibility兼容性)  

*说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计*

  


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

  


自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#7-document资料)  

  


##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[coast2-Page-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmNhMWFkOWEzMzExZGM3ZWU3IiwicmVmX2lkIjoiNjczOTZhZmM1OTNmOTljOWZmMjM1YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTA4LCJleHAiOjE3ODIzNzY5MDh9.yGoZYsy6OvfO4AAn1grr_K3sCo3l0YTgX4AACfqDieM)

 (image/png)    


[coast2-Page-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmM4OTcwYzJhZjRmNTIwMDcxIiwicmVmX2lkIjoiNjczOTZhZmM1OTNmOTljOWZmMjM1YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTA4LCJleHAiOjE3ODIzNzY5MDh9.87TLksVKdkUFfsnDAK0OmTYIJBO5VuAUolKpBjKr3nk)

 (image/png)    


[coast2-Page-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmNhMWFkOWEzMzExZGM3ZWU5IiwicmVmX2lkIjoiNjczOTZhZmM1OTNmOTljOWZmMjM1YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTA4LCJleHAiOjE3ODIzNzY5MDh9.UC6_Uk7u8cApNWNDlGCCY6gcqz4ZORUEBJS1VT4U_HQ)

 (image/png)    


[coast2-Page-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmNhMWFkOWEzMzExZGM3ZWVhIiwicmVmX2lkIjoiNjczOTZhZmM1OTNmOTljOWZmMjM1YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTA4LCJleHAiOjE3ODIzNzY5MDh9.R_o3ShUWu_djY_RLbh_cl1qhcMLtBKBi4q0ihO0Yt_M)

 (image/png)    


[image2023-6-14_17-49-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmQ4OTcwYzJhZjRmNTIwMDc1IiwicmVmX2lkIjoiNjczOTZhZmM1OTNmOTljOWZmMjM1YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTA4LCJleHAiOjE3ODIzNzY5MDh9.MGDFGzWNTQ-tAAn9vlQ5iRXycGWUDxPh7q8wTRmIGIw)

 (image/png)    


[image2023-6-14_17-51-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmRhMWFkOWEzMzExZGM3ZWViIiwicmVmX2lkIjoiNjczOTZhZmM1OTNmOTljOWZmMjM1YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTA4LCJleHAiOjE3ODIzNzY5MDh9.E3X59JXytUbunw1x1eTW-hWRR-uRY27M_EF9qV3QC2o)

 (image/png)    


[image2023-6-14_18-5-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmRhMWFkOWEzMzExZGM3ZWVlIiwicmVmX2lkIjoiNjczOTZhZmM1OTNmOTljOWZmMjM1YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTA4LCJleHAiOjE3ODIzNzY5MDh9.9bcAwjHFdg_hEUahbiuMK40glZSwLYTK1mqBMgEcc_8)

 (image/png)    


[image2023-6-15_9-25-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmQ4OTcwYzJhZjRmNTIwMDc5IiwicmVmX2lkIjoiNjczOTZhZmM1OTNmOTljOWZmMjM1YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTA4LCJleHAiOjE3ODIzNzY5MDh9.LYImcb8CXWXW7em30P9SfBh-PW2xg2oXrqQIctDeSVI)

 (image/png)    


[image2023-6-26_9-45-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmRhMWFkOWEzMzExZGM3ZWYwIiwicmVmX2lkIjoiNjczOTZhZmM1OTNmOTljOWZmMjM1YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTA4LCJleHAiOjE3ODIzNzY5MDh9.AEcRHQGYxsDN3QaQpCDw2MS6sfUg7x7_i7Kxg2m3weM)

 (image/png)    


[image2023-6-29_15-32-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmRhMWFkOWEzMzExZGM3ZWYxIiwicmVmX2lkIjoiNjczOTZhZmM1OTNmOTljOWZmMjM1YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTA4LCJleHAiOjE3ODIzNzY5MDh9.aW4o-KHbjUf7FiLWz-4UAItqyfl2OcReRSOPNCATHOM)

 (image/png)    


[image2023-6-29_15-42-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZmQ4OTcwYzJhZjRmNTIwMDdjIiwicmVmX2lkIjoiNjczOTZhZmM1OTNmOTljOWZmMjM1YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTA4LCJleHAiOjE3ODIzNzY5MDh9.iQ5d6kyc6iXL32IOw34lD-aDAPWZfyE6G0rFOSHsQp4)

 (image/png)    


## Comments:

|  [](null)  ,1，localfs语法不变，,2，bucket name不带引号，bucket名称能否带/?，创建时检查是否合法,3，alter databucket ‘xx’ readonly | readwrite.,      databucket$ readonly.,Posted by xierui at 六月 29, 2023 10:05|
|---|
|  [](null)  ,maxsize可选，默认unlimited,Posted by xierui at 六月 30, 2023 11:25|

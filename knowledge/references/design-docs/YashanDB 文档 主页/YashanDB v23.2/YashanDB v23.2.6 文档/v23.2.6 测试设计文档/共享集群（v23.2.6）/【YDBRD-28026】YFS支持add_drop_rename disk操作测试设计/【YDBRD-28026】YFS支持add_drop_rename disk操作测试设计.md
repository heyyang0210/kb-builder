Created by 徐凡博, last modified by  张志华 on 十一月 06, 2024

SR链接：    [https://pingcode.yasdb.com/pjm/items/66114fc4579a3edb84d66832](https://pingcode.yasdb.com/pjm/items/66114fc4579a3edb84d66832)    ?    
  #YDBRD-18594 YFS支持add/drop/alter disk操作

开发设计文档：    [YDBRD-18594 yfs支持add/drop disk操作 - YashanDB 文档 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159427008)  

## **1. 概述**

本文描述共享集群需求YFS支持add/drop/alter disk操作的测试设计。

## **2. 需求分析**

### 2.1 功能点分析

新增drop/rename disk；add disk，create/drop/dismount/mount diskgroup，原有功能不变，修改故障场景处理。

1、语法：

![](https://conf.yasdb.com/download/attachments/159427008/image2024-7-4_11-47-32.png?version=1&modificationDate=1720688200000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMyMDUsImV4cCI6MTc4MjMyNDAwNX0.d24aN_XlyNnQ7iFJqvoJ-i6M_N1-OW0oDJHtQC5vBKY)

- **drop disk：**


![](https://conf.yasdb.com/download/attachments/159427008/image2024-7-4_11-40-14.png?version=1&modificationDate=1720688200000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMyMDUsImV4cCI6MTc4MjMyNDAwNX0.d24aN_XlyNnQ7iFJqvoJ-i6M_N1-OW0oDJHtQC5vBKY)

![](https://conf.yasdb.com/download/attachments/159427008/image2024-7-4_11-40-28.png?version=1&modificationDate=1720688201000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMyMDUsImV4cCI6MTc4MjMyNDAwNX0.d24aN_XlyNnQ7iFJqvoJ-i6M_N1-OW0oDJHtQC5vBKY)

![](https://conf.yasdb.com/download/attachments/159427008/image2024-7-4_11-40-40.png?version=1&modificationDate=1720688201000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMyMDUsImV4cCI6MTc4MjMyNDAwNX0.d24aN_XlyNnQ7iFJqvoJ-i6M_N1-OW0oDJHtQC5vBKY)

- **rename disk：**


![](https://conf.yasdb.com/download/attachments/159427008/image2024-7-4_11-52-6.png?version=1&modificationDate=1720688201000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMyMDUsImV4cCI6MTc4MjMyNDAwNX0.d24aN_XlyNnQ7iFJqvoJ-i6M_N1-OW0oDJHtQC5vBKY)

2、应用场景：

- 单集群和主备集群场景下，add/drop/rename disk正常；
- add/drop/rename disk并发yfs备机加入/退出
- add/drop/rename disk并发yfs主/备故障
- add/drop/rename disk并发主备集群切换
- add/drop/rename disk失败处理


### 2.2 规格约束

|属性|场景名称|是否本SR重点功能|说明/约束|是否需要新增用例场景|备注|
|:---|:---|:---|:---|---|:---|
|drop disk|diskgroup 删除磁盘|是|- 只能删除空盘；
- 不能删除boot disk；
- 删除disk后，各fg中磁盘数量需保持一致；
- 用户可以选择从所有 fg 删除磁盘，或者整除整个 fg，不能在一次操作中同时删除 disk 和 fg。
- 磁盘或failgroup 清单，不允许有重复名称。
- 减少fg的磁盘时，剩余fg需满足yfs冗余度最低要求，  由于 dg 的元数据副本数 >= 用户数据副本数，因此剩余 fg 数量受 dg 的元数据副本数约束，元数据副本数在创建 dg 时确定：
-     1. external：1副本
    1. normal：2~3副本
    1. high：3~5 副本

|需要，全量测试|  
|
|rename disk|修改disk name|是|- 磁盘名称全局唯一，新名称不能与任何新名称、旧名称相同；
- 最长31字符，超过31字符会报错；
|需要，全量测试|  
|
|add disk|往diskgroup 添加磁盘|旧功能，本SR有扩展|- dg内的disk大小一致；
- 增加disk后，各fg中磁盘数量一致；
- 已添加至yfs中的磁盘，不能再次添加；
- disk名称全局唯一，不仅限于dg内。
|需要，全量测试|  
|
|~~replace disk~~|~~替换磁盘~~|暂不转测|  
|  
|  
|
|create diskgroup|创建diskgroup|旧功能，保证功能不退化|  
|需要，除原有用例复用外，增加故障场景测试|  
,  
|
|drop diskgroup|drop diskgroup|旧功能，保证功能不退化|  
|需要，除原有用例复用外，增加故障场景测试|  
|
|dismount diskgorup|dismount diskgroup|旧功能，保证功能不退化|  
|需要，除原有用例复用外，增加故障场景测试|  
|
|mount diskgroup|mount diskgroup|旧功能，保证功能不退化|  
|需要，除原有用例复用外，增加故障场景测试|  
|


## **3. 详细测试设计**

### 3.1 测试设计方法

语法中的参数采用等价类、边界值测试，多个参数组合采用正交组合验证；

场景测试主要考虑并发故障，通过场景法和错误猜测法进行测试。

### 3.2 详细测试设计

#### 3.2.10 是否涉及DFX测试

|系统级DFX分类|是否涉及|说明|
|:---|:---|---|
|CT|是|该特性需要验证并发执行|
|KT|是|该特性需要验证执行过程中并发故障，及其故障后表现、处理及重入|
|长稳|否|该特性对原有功能不影响|
|一致性|否|不涉及db级别的一致性，不考虑|
|三方测试工具    
  (sqltest，sqlancer)|否|该特性新增yfs语法，sql语法无新增|
|安全|否|不涉及任务用户/权限/密码等操作，不涉及该专项|
|DFR|是|涉及到不同类型的故障|
|HA|是|该特性在HA上可用，需要进行验证|
|压力|否|yfs层面不考虑压力场景，不涉及该专项|
|性能|否|不涉及任何性能层面的优化和修改，不涉及该专项|
|可维护性|是|异常时需要明显的报错日志进行问题定位|
|RTO|是|涉及yfs磁盘处理转移，需要进行验证|


### 3.3 详细测试设计

此次测试包括：

- add/drop/rename disk全量测试，包括语法、场景测试；
- create/drop/mount/dismount diskgroup故障测试及原有用例复用。


#### 3.3.1 add disk测试

语法测试：

```
<span class="token rule">ALTER DISKGROUP dgname&nbsp;</span>
```

|编号|参数|取值|优先级|负责人|  
|
|---|---|---|---|---|---|
|1|quorum|regular|该参数无意义，拼写错误、缺失|高|开发|pass|
|2|failgroup_name|字符类型：英文字符大小写、数字、特殊字符、中文、符号等组合（与add结合，受create限制）|高|开发|pass|
|3|  
|字符个数：空、1-31个，32个往上|高|开发|pass|
|4|  
|名称：不存在、罗列1个、多个、重复|高|开发|pass|
|5|disk_name|字符类型：英文字符大小写、数字、特殊字符、中文、符号等组合（与add结合，受add限制）|高|开发|pass|
|6|  
|字符个数：空、1-31个，32个往上|高|开发|pass|
|7|  
|名称：不存在、罗列1个、多个、重复|高|开发|pass|
|8|  `diskpath`  |共享盘存在，且权限正常|高|开发|pass|
|9|  
|本地文件|高|开发|pass|
|10|  
|路径不存在|高|开发|pass|
|11|  
|路径权限不足，要求是666|高|开发|pass|
|12|  
|路径字符类型：英文字符大小写、数字、特殊字符、中文、符号等组合|高|开发|pass|
|13|  
|字符个数：空、1-255个，255个往上|高|开发|pass|
|14|  
|路径个数：1个，多个|高|开发|pass|
|15|size|正常值如100M|高|开发|pass|
|16|  
|异常值：纯数字、字母、字符、中文、符号以及组合，|高|开发|pass|
|17|  
|空、1个、多个、重复|高|开发|pass|
|18|force|noforce|force、noforce、缺失默认noforce|高|开发|pass|
|19|各关键字|缺失、拼写错误、重复|高|开发|pass|


场景测试：

|编号|场景|测试点|优先级|负责人|  
|
|---|---|---|---|---|---|
|1|正向场景|在线每个fg增加一个disk|高|开发|pass|
|2|  
|在线每个fg增加多个disk|高|开发|pass|
|3|  
|增加1或者2个fg，fg中disk个数与已有fg一致（结合副本测试）|高|开发|pass|
|4|  
|增加前所有dg内disk数量相同，所有dg都增加1个disk|高|开发|pass|
|5|  
|增加前每个dg内disk数量不一致（场景构造，前一次增加失败，只给一个dg增加了disk），给少disk的dg增加disk|高|开发|pass|
|6|  
|add后drop，再次add，加force，重复多次|高|开发|pass|
|7|  
|add后drop，再次add，不加force|高|开发|pass|
|8|  
|多实例并发add相同disk|高|开发|pass|
|9|  
|多实例并发add不同disk|高|开发|pass|
|10|反向--约束场景|增加的disk大小不一致|高|开发|pass|
|11|  
|增加的disk与fg内的大小不一致|高|开发|pass|
|12|  
|增加的disk是已经在fg中使用的disk|高|开发|pass|
|13|  
|增加的disk重名|高|开发|pass|
|14|  
|增加的disk与所有fg中已经存在的disk重名|高|开发|pass|
|15|  
|已经使用过的disk，drop diskgroup/drop disk后，重新add到新集群，不加force，报错|高|开发|pass|
|  
|  
|diskgroup在dismount时不能add|  
|  
|  
|
|16|交互|add时并发加入/退出实例|高|开发|pass|
|17|  
|yfs主/备故障时，下发add|高|开发|pass|
|18|  
|主备节点切换时，add disk|高|开发|pass|
|19|集群只剩主节点，yfs主故障|进程kill|低|测试|YDBRD-30947|
|20|执行节点为yfs备，yfs主故障|yfs进程kill|高|测试|PASS|
|21|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|22|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|23|  
|kill yfscmd进程|高|测试|PASS|
|24|  
|kill -19挂住ycs进程|高|测试|PASS|
|25|  
|手动随机Ctrl c|低|测试|PASS|
|26|执行节点为yfs主，yfs主故障|yfs进程kill|高|测试|PASS|
|27|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|28|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|29|  
|kill yfscmd进程|高|测试|PASS|
|30|  
|kill -19挂住ycs进程|高|测试|PASS|
|31|  
|手动随机Ctrl c|低|测试|PASS|
|32|执行节点为yfs备，该节点yfs备故障|yfs进程kill|高|测试|PASS|
|33|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|34|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|35|  
|kill yfscmd进程|高|测试|PASS|
|36|  
|kill -19挂住ycs进程|高|测试|PASS|
|37|  
|手动随机Ctrl c|低|测试|PASS|


#### 3.3.2 drop disk测试

语法测试：  ALTER DISKGROUP diskgroup_name DROP [QUORUM|REGULAR] DISK (disk_name [FORCE|NOFORCE] {"," disk_name [FORCE|NOFORCE]}) | DROP DISKS IN [QUORUM|REGULAR] FAILGROUP (failgroup_name [FORCE|NOFORCE] {"," failgroup_name [FORCE|NOFORCE]})

|编号|参数|取值|优先级|负责人|  
|
|---|---|---|---|---|---|
|1|quorum|regular|该参数无意义，拼写错误、缺失|高|开发 马勇|PASS|
|2|disk_name|字符类型：英文字符大小写、数字、特殊字符、中文、符号等组合（与add结合，受add限制）|高|开发 马勇|PASS|
|3|  
|字符个数：空、1-31个，32个往上|高|开发 马勇|PASS|
|4|  
|名称：不存在、罗列1个、多个、重复|高|开发 马勇|PASS|
|5|force|noforce|该参数无意义，force、noforce、缺失默认noforce|高|开发 马勇|PASS|
|6|failgroup_name|字符类型：英文字符大小写、数字、特殊字符、中文、符号等组合（与add结合，受create限制）|高|开发 马勇|PASS|
|7|  
|字符个数：空、1-31个，32个往上|高|开发 马勇|PASS|
|8|  
|名称：不存在、罗列1个、多个、重复|高|开发 马勇|PASS|
|9|drop disk|in failgroup结合使用，与drop disks一起使用|高|开发 马勇|PASS|
|10|drop disks|不与in failgroup结合使用|高|开发 马勇|PASS|
|11|各关键字|缺失、拼写错误、重复|高|开发 马勇|PASS|


场景测试：

|编号|场景|测试点|优先级|负责人|  
|
|---|---|---|---|---|---|
|1|正向场景|3个fg（每个fg多于1 disk），在线删除每个fg中的最后1个未使用的disk|高|开发 马勇|PASS|
|2|  
|4个fg，normal 冗余度，meta 3 副本， 正常 drop 最后一个 fg|高|开发 马勇|PASS|
|3|  
|删除前每个dg内disk数量不一致（场景构造，前一次增加失败，只给一个dg增加了disk），给多disk的dg drop disk|高|开发 马勇|PASS|
|4|  
|drop disk后，重新add，必须加force，重复多次，（不加force失败）|高|开发 马勇|PASS|
|5|  
|多实例并发drop相同disk|高|开发 风朴|pass|
|6|  
|多实例并发drop不同disk|高|开发 风朴|pass|
|7|反向--约束场景|删除非空disk（大量数据，删除第2个disk）|高|开发 马勇|PASS|
|8|  
|删除boot disk（删除第一个disk）|高|开发 马勇|PASS|
|9|  
|删除fg后，各fg中disk数量不一致（3个fg，删除1个fg中的1个disk，删除2个fg中的各1个disk）|高|开发 马勇|PASS|
|10|  
|删除fg时，不满足冗余度（normal 冗余度时，3个fg，元数据冗余度是3，删除1个fg，报错）|高|开发 马勇|PASS|
|11|  
|每个fg中删除一个disk，但是disk的位置不一致，如fg1中第2个，fg2中第3个--文档中限制，但该场景后续有空间但不能使用，不能影响数据库运行|高|开发 马勇|PASS|
|  
|  
|diskgroup在dismount时不能drop|  
|开发 马勇|PASS|
|12|交互|drop时并发加入/退出实例|高|开发 风朴|pass|
|13|  
|yfs主/备故障时，下发drop|高|开发 风朴|pass|
|14|  
|主备节点切换后，drop disk|高|开发 风朴|pass|
|15|集群只剩主节点，yfs主故障|进程kill|低|测试|PASS|
|16|执行节点为yfs备，yfs主故障|yfs进程kill|高|测试|YDBRD-30986,YDBRD-30982|
|17|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|18|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|19|  
|kill yfscmd进程|高|测试|PASS|
|20|  
|kill -19挂住ycs进程|高|测试|PASS|
|21|  
|手动随机Ctrl c|低|测试|PASS|
|22|执行节点为yfs主，yfs主故障|yfs进程kill|高|测试|PASS|
|23|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|24|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|25|  
|kill yfscmd进程|高|测试|PASS|
|26|  
|kill -19挂住ycs进程|高|测试|PASS|
|27|  
|手动随机Ctrl c|低|测试|PASS|
|28|执行节点为yfs备，该节点yfs备故障|yfs进程kill|高|测试|PASS|
|29|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|YDBRD-30973|
|30|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|31|  
|kill yfscmd进程|高|测试|PASS|
|32|  
|kill -19挂住ycs进程|高|测试|PASS|
|33|  
|手动随机Ctrl c|低|测试|PASS|


#### 3.3.3 rename disk测试

语法测试：  ALTER DISKGROUP diskgroup_name   RENAME ((DISK old_disk_name TO new_disk_name {"," old_disk_name TO new_disk_name}) | (DISKS ALL))

|编号|参数|测试点|优先级|负责人|  
|
|---|---|---|---|---|---|
|1|old_disk_name|字符类型：英文字符大小写、数字、特殊字符、中文、符号等组合（与add结合，受add限制）|高|开发 马勇|PASS|
|2|  
|字符个数：空、1-31个，32个往上|高|开发马勇|PASS|
|3|  
|名称：不存在、罗列1个、多个、重复|高|开发马勇|PASS|
|4|new_disk_name|字符类型：英文字符大小写、数字、特殊字符、中文、符号等组合（与add结合，受add限制）|高|开发马勇|PASS|
|5|  
|字符个数：空、1-31个，32个往上|高|开发马勇|PASS|
|6|  
|名称：与old_disk_name一致，与其他旧disk名称一致，与其他新disk名称一致，与其他对象如果fg、dg一致，与fs上对象名一致|高|开发马勇|PASS|
|7|disks all|disk与all结合使用，disks all与disk to同时使用|高|开发马勇|PASS|
|8|disk  to|disks与to结合使用|高|开发马勇|PASS|
|9|各关键字|缺失、拼写错误、重复|高|开发马勇|PASS|


#### 场景测试：

|编号|场景|测试点|优先级|负责人|  
|
|---|---|---|---|---|---|
|1|正向场景|rename boot disk|高|开发|PASS|
|2|  
|在线rename disk所有磁盘|高|开发|PASS|
|3|  
|rename disks all执行多次不报错，dg创建时名字为30个字符，rename时DG名称 = dgname 前26个字符 + ‘_’ + '_0'|高|开发|PASS|
|4|  
|多实例并发rename相同disk|高|开发|PASS|
|5|  
|多实例并发rename不同disk|高|开发|PASS|
|  
|约束|diskgroup dismount后，不能rename|  
|  
|PASS|
|  
|  
|修改dg1中的disk名称与dg2中rename disks all之后的名称重名，对dg2中的disk rename disks all，报错,  
,创建两个前 26 字符相同的 dg，先后执行 rename all，第二个 dg rename all 时报disk 名称冲突错误。|  
|开发|PASS|
|6|交互集群操作|rename时并发加入/退出实例|高|开发|PASS|
|7|  
|yfs主/备故障时，下发rename|高|开发|PASS|
|8|  
|主备节点切换后，rename disk|高|开发| PASS|
|10|集群只剩主节点，yfs主故障|进程kill|高|测试|YDBRD-31048,YDBRD-30996,YDBRD-31055|
|11|执行节点为yfs备，yfs主故障|yfs进程kill|高|测试|YDBRD-30996|
|12|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|13|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|YDBRD-31064|
|14|  
|kill yfscmd进程|高|测试|  
|
|15|  
|kill -19挂住ycs进程|高|测试|  
|
|16|  
|手动随机Ctrl c|低|测试|  
|
|17|执行节点为yfs主，yfs主故障|yfs进程kill|高|测试|PASS|
|18|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|19|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|  
|
|20|  
|kill yfscmd进程|高|测试|  
|
|21|  
|kill -19挂住ycs进程|高|测试|  
|
|22|  
|手动随机Ctrl c|低|测试|  
|
|23|执行节点为yfs备，该节点yfs备故障|yfs进程kill|高|测试|PASS|
|24|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|PASS|
|25|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|  
|
|26|  
|kill yfscmd进程|高|测试|  
|
|27|  
|kill -19挂住ycs进程|高|测试|  
|
|28|  
|手动随机Ctrl c|低|测试|  
|


#### 3.3.4 create/drop/mount/dismount测试

原有用例复用——yfs相关工程：

  [https://jenkins.yasdb.com/user/zhangcaihong/my-views/view/%E5%BC%A0%E5%BD%A9%E8%99%B9/job/master_L3_cluster_ha_yfs_arm/](https://jenkins.yasdb.com/user/zhangcaihong/my-views/view/%E5%BC%A0%E5%BD%A9%E8%99%B9/job/master_L3_cluster_ha_yfs_arm/)  

  [https://jenkins.yasdb.com/user/zhangcaihong/my-views/view/%E5%BC%A0%E5%BD%A9%E8%99%B9/job/dev_L2_cluster_yasft_yfs_arm/](https://jenkins.yasdb.com/user/zhangcaihong/my-views/view/%E5%BC%A0%E5%BD%A9%E8%99%B9/job/dev_L2_cluster_yasft_yfs_arm/)  

  [https://jenkins.yasdb.com/user/zhangcaihong/my-views/view/%E5%BC%A0%E5%BD%A9%E8%99%B9/job/master_L3_cluster_yasft_yfs_arm/](https://jenkins.yasdb.com/user/zhangcaihong/my-views/view/%E5%BC%A0%E5%BD%A9%E8%99%B9/job/master_L3_cluster_yasft_yfs_arm/)  

  [https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_CT_yfs_arm/](https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_CT_yfs_arm/)  

新增交互、故障测试：

|编号|场景|测试点|优先级|负责人|结果|
|---|---|---|---|---|---|
|1|功能|原有用例复用|  
|  
|  
|
|2|  
|create/drop/mount/dismount时并发执行|高|开发|  
|
|3|  
|create/drop/mount/dismount时并发加入/退出实例|高|开发|  
|
|4|  
|yfs主/备故障时，下发create/drop/mount/dismount|高|开发|  
|
|5|  
|主备集群切换，下发create/drop/mount/dismount|低|开发|  
|
|6|集群只剩主节点，yfs主故障|进程kill|高|测试|pass|
|7|执行节点为yfs备，yfs主故障|yfs进程kill|高|测试|pass|
|8|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|pass|
|9|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|pass|
|10|  
|kill yfscmd进程|高|测试|pass|
|11|  
|kill -19挂住ycs进程|高|测试|pass|
|12|  
|手动随机Ctrl c|低|测试|pass|
|13|执行节点为yfs主，yfs主故障|yfs进程kill|高|测试|pass|
|14|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|pass|
|15|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|YDBRD-31064|
|16|  
|kill yfscmd进程|高|测试|pass|
|17|  
|kill -19挂住ycs进程|高|测试|pass|
|18|  
|手动随机Ctrl c|低|测试|pass|
|19|执行节点为yfs备，该节点yfs备故障|yfs进程kill|高|测试|pass|
|20|  
|业务网络故障（down优先级最高、丢包、延时、闪断）|高|测试|  [YDBRD-31077](null)  |
|21|  
|存储网络故障（down优先级最高、丢包、延时、闪断）|高|测试|pass|
|22|  
|kill yfscmd进程|高|测试|pass|
|23|  
|kill -19挂住ycs进程|高|测试|pass|
|24|  
|手动随机Ctrl c|低|测试|pass|


# 4. 测试用例

冒烟用例：

drop disk冒烟用例：    
  正向：    
  drop 空盘成功，     
  drop 1个fg中的所有disk，满足冗余度时成功     
  反向：    
  drop 1个fg中的所有disk，不满足冗余度时失败     
  drop 非空盘失败     
  drop boot disk失败      
  drop 1个fg中的1个disk，不满足删除disk后，各fg disk数量一致，拦截校验，删除失败     
  drop 整个fg和disk，失败 

场景：备机执行drop，drop到不同阶段主机down，drop成功

rename disk冒烟用例：    
  正向：    
  rename名称正常     
  自动rename     
  自动rename多次     
  rename to 名称超过31字符，截断，成功 （这里会报错，不会自动截断）    
  反向：    
  rename重名，报错（如果重命名前后名称没有变化，正常）    
  rename to 名称缺失 

场景：备机执行rename，rename到不同阶段主机down，drop成功

add disk冒烟用例：    
  正向：    
  不带fg关键字时，add disk成功      
  创建fg时，add disk成功     
  反向：    
  只给一个fg添加disk，不满足各fg disk数量一致，失败     
  add时disk重名，报错 

场景：备机执行add，add到不同阶段主机down，drop成功

# 5. 测试框架设计

使用ha框架实现用例看护，无需新增框架。

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 7. 工作量评估

测试工作量：2.5人周
Created by 马勇, last modified on 七月 11, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#1-%E6%80%BB%E8%BF%B0)  

目前 YFS 对 diskgroup 调整能力较弱，本方案进一步提高 YFS 对 diskgroup 的调整能力。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

  


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**概述**     友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

  [ASM add/drop disk 调研](https://conf.yasdb.com/pages/viewpage.action?pageId=147774143)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

目前 YFS 目前仅支持 add disk，尤其是对 drop disk 等操作支持不足。经调研，YFS 将增加以下功能支持：

|功能|说明|
|---|---|
|rename|修改 disk name|
|drop disk|从现有 diskgroup 移除 disk|
|drop disks in failgroup|移除整个 failgroup|
|replace|替换磁盘|


所有 drop 和 replace 相关的操作，都涉及数据迁移，目前 YFS 仅支持离线迁移。

  


暂未确定离线迁移的形式：

- yfs 不重启，直接进入 迁移模式，迁移完毕再返回正常模式


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|YFS 迁移模式|单机时可进入 迁移模式，仅接受 exec 指令，不允许打开文件，除 YFS 服务外，不允许执行任何IO操作。|无|  
|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#2-%E6%8E%A5%E5%8F%A3)  

**接口分类：**

- yfscmd exec 新增指令，


|接口|接口表现|接口说明|
|:---|:---|:---|
|ALTER DISKGROUP data1 DROP DISK diska5;|移除 disk|在线时仅允许删除空 disk，如有数据仅支持离线模式。|
|ALTER DISKGROUP fra2 RENAME DISK 'FRA1_0001' TO 'FRA2_0001', 'FRA1_0002' TO 'FRA2_0002';|disk 重命名|定制实现，连续分配, truncate 指令新增 -c，表示连续分配|
|  `ALTER DISKGROUP fra2 DROP`         `DISKS`         `IN`         `FAILGROUP fg1 force, fg2 force;`  |移除整个 failgroup。|仅允许删除空 failgroup 或 所有 disk 都是空的|
|ALTER DISKGROUP data2 REPLACE DISK diskc7 WITH '/devices/diskc18' ;|替换 disk|在线时仅允许替换空 disk，如磁盘有数据仅支持离线模式|


  


**操作磁盘数量待设置规格**

  


**语法图**

**参考**    [https://docs.oracle.com/en/database/oracle/oracle-database/12.2/sqlrf/ALTER-DISKGROUP.html](https://docs.oracle.com/en/database/oracle/oracle-database/12.2/sqlrf/ALTER-DISKGROUP.html)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e05a1ad9a3311dc94cb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

![](https://pingcode.yasdb.com/atlas/files/public/67396e058970c2af4f521658/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

![](https://pingcode.yasdb.com/atlas/files/public/67396e05a1ad9a3311dc94cc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

![](https://pingcode.yasdb.com/atlas/files/public/67396e058970c2af4f521659/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

![](https://pingcode.yasdb.com/atlas/files/public/67396e058970c2af4f52165a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

![](https://pingcode.yasdb.com/atlas/files/public/67396e06a1ad9a3311dc94cd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

![](https://pingcode.yasdb.com/atlas/files/public/67396e068970c2af4f52165b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

![](https://pingcode.yasdb.com/atlas/files/public/67396e068970c2af4f52165c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

```
ALTER_DISKGROUP = ALTER DISKGROUP diskgroup_name (DISMOUNT | MOUNT | add_disk_clause | drop_disk_cluase | replace_disk_clause | rename_clause).

add_disk_clause = ADD [SITE site_name] ([QUORUM|REGULAR] [FAILGROUP failgroup_name] DISK qualified_disk_clause {"," qualified_disk_clause}) {[QUORUM|REGULAR] [FAILGROUP failgroup_name] DISK qualified_disk_clause {"," qualified_disk_clause}}.

qualified_disk_clause = "'" diskpath "'" [NAME diskname] [SIZE size] [FORCE|NOFORCE].

drop_disk_cluase = (drop_individual_disk_clause | drop_failgroup_clasue).

drop_individual_disk_clause = DROP [QUORUM|REGULAR] DISK (disk_name [FORCE|NOFORCE] {"," disk_name [FORCE|NOFORCE]}).

drop_failgroup_clasue = DROP DISKS IN [QUORUM|REGULAR]  FAILGROUP (failgroup_name [FORCE|NOFORCE] {"," failgroup_name [FORCE|NOFORCE]}).

replace_disk_clause = REPLACE DISK disk_name WITH "'" path_name "'" [FORCE|NOFORCE] { "," disk_name WITH "'" path_name "'" [FORCE|NOFORCE]}.

rename_clause = RENAME ((DISK old_disk_name TO new_disk_name {"," old_disk_name TO new_disk_name}) | (DISKS ALL)).

```

  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

### 3.1 YFS 的基本约束

diskgroup、failgroup、disk 在任何时候都遵守 YFS 的一系列约束：

1. diskgroup 的数据冗余度和元数据冗余度在创建 diskgroup 时确定，au size 在创建 diskgroup 时确定，之后不能修改。
1. diskgroup 中所有 disk 大小必须相等，如果物理存储大小不同，必须在 disk 加入时指定 size，确保所有 disk 的 size 一致。
1. failgroup 数量必须大于等于冗余度对应的副本数量。比较特殊的是 diskgroup 元数据冗余度，  **如创建 diskgroup 时 failgroup 充足，那么元数据冗余度会比数据冗余度高。failgroup 最小值取 diskgroup 数据冗余度和元数据冗余度较大的值**  。
1. 文件各副本数据必须位于不同 failgroup。


在增减盘中，有可能出现不平衡的 diskgroup，比如各 fg disk 数量不一致，允许用户 drop 不平衡的 disk，重新操作。

一个 diskgroup 仅允许 1 个正在执行的 plan。

  


**3.2 减盘操作要求**

用户通过 drop disk 移除磁盘，允许两种方式：

1. 明确指定需 drop 的disk：不允许改变 failgroup 数量，且操作后 diskgroup 的预期结构必须是平衡的，各 failgroup 磁盘数量必须一致。（drop 操作可能被中断，允许出现不平衡的 fg）
1. 移除完整的 failgroup：改变 failgroup 数量后，diskgroup 结构需满足 YFS 冗余度和 failgroup 关系的约束。
1. 不允许在一次操作中混合这两种操作


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#4-%E7%89%B9%E6%80%A7)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**     针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

*关键技术点展开要借鉴结构化分析或者UML工具，设计方案优选用图，要求如下（理论指导的斜体内容在正式文档可以直接删除）*     各图如何画可以用参照链接       [https://conf.yasdb.com/pages/viewpage.action?pageId=135603021](https://conf.yasdb.com/pages/viewpage.action?pageId=135603021)  

*1）结构化设计方法：数据流图 + 状态转换图 + ER图*

*2）UML工具呈现4+1视角*

```
用例视图：用例图（通过 场景描述，以及对应场景下的设计方案，也可以直接用例描述）

逻辑视图：类图<span class="hljs-regexp" style="color: rgb(188,96,96);">/对象图/</span>构件图/包图（特性下各模块的分工配合）

实现视图<span class="hljs-regexp" style="color: rgb(188,96,96);">/进程视图：顺序图/</span>活动图<span class="hljs-regexp" style="color: rgb(188,96,96);">/状态图/</span>定时图（详细设计文档更为关注、概要设计多为特性框架视角）

部署视角：部署图 （子特性不涉及，总体设计文档涉及）

```

**图为工具也是编码的抽象，便于项目干系人（TL/SE/PL/MDE/开发人员）理解特性的实现方案原理。**

###   [4.0 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    diskgroup 状态图

![](https://pingcode.yasdb.com/atlas/files/public/67396e06a1ad9a3311dc94ce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

diskgroup 的读写状态不持久化。

所有节点可以由主机设置其状态。

![](https://pingcode.yasdb.com/atlas/files/public/67396e06a1ad9a3311dc94cf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

主机准备进入迁移模式，先等待自身所有 IO 结束，将自身 diskgroup 设置为迁移模式，再向备机发送消息，设置 diskgroup 为迁移模式

![](https://pingcode.yasdb.com/atlas/files/public/67396e06a1ad9a3311dc94d0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

各备机等待各自 IO 结束，设置diskgroup 为迁移模式，向主节点返回 ACK，主节点可以执行数据迁移工作。

![](https://pingcode.yasdb.com/atlas/files/public/67396e06a1ad9a3311dc94d1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

主可能在迁移过程中故障，新主可能有 diskgroup 处于迁移模式，新主无论自己是否有 diskgroup 处于迁移模式，都向设置所有节点发送消息，解除所有迁移模式。

当所有节点返回 ACK 时，主节点设置自己的 diskgroup 为正常模式。

迁移状态下，不允许新节点加入，避免备机读到中间结果。

  


备升主增加操作：    
  1. 读取 diskctrl，disk ctrl 记录的 disks 应为本机内存 disk 记录的子集，剔除本机内存多出来的 disk，更新发生变化的 disk 信息。    
  2. 读取所有持久化的 disk header，更新本地 disk 状态。

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    add disk

![](https://pingcode.yasdb.com/atlas/files/public/67396e068970c2af4f52165d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

1. format disks，disk 状态为 offline (主机 core，备升主看不到 format 的disk)    
  2. write diskctrl(ycs or diskctrl)（主机 core，备升主、备加入新主前读取 diskctrl，获取新增 disk 信息）

3. sync standby diskctrl （主机 core，各备机可能有不同的 disk 清单，备升主、备加入新主前读取 diskctrl 更新 disk 信息）    
  4. 更新已有磁盘 pst，先刷盘，后 sync，可以合并同步（主机 core，备升主无需额外操作，offline 磁盘不参与空间分配）    
  5. write disk header，更新新增磁盘状态为 online （主机core，备升主无需额外操作，未online disk 不参与空间分配）    
  6. sync standby disks info，disks online(主机 core，主机 core，备升主、备加入新主前读取所有磁盘 disk header，更新磁盘状态。)    
  7. set master shm disk online（主机 core没影响）

###   [4.0 drop disk](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    /disks

1. 迁移数据    
  2. set 所有待删除 disk.status = offline，先刷盘后 sync（备升主、备加入新主前读取所有磁盘 disk header，更新磁盘状态）    
  3. 从所有磁盘的 pst 中移除待删除 disk，先刷盘，后 sync，可以合并同步（主机core，备升主无需额外操作，未online disk 不参与空间分配）    
  4. write diskctrl，移除待删除 disk(主机 core，备升主、备加入新主前读取 diskctrl，移除已删除的 disk 信息)

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    replace

1. 磁盘二进制复制(主机 core，备机无影响)    
  2. write diskctrl，更新被替换的disk 信息。（主机 core，备升主、备加入新主前读取 diskctrl，更新与本地记录不同的 disk 信息）    
  3. sync to standby(主机core，备升主、备加入新主前读取 diskctrl，更新与本地记录不同的 disk 信息)

###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    rename

![](https://pingcode.yasdb.com/atlas/files/public/67396e06a1ad9a3311dc94d2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FaSUFBQWdBZ0FFQUFBQUFBQUFFQUlBZ1FoQVFJUUdJQkFBRVJBQUVBZ0FBQ0FBQUFBSUFBQUFBZ0FBQUFCQUFBSVFBQUFRQWdCQUFBZ0FBQUFJQUNBQUFBRUFBQndBQUFBQkFBUUFBUUFrQWdDRWdZQUFBQUlBQUFBSUFBQUFBQUFBQUFJUkNBQUVBQkFBUUFBQkVJSUFBQUFBSUlBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM2NTUsImV4cCI6MTc4MjMyNDQ1NX0.tiLbYMDpGegDqmgcFCV6GIBM-1oBxzg-Y18t3ny6pIc)

## 5. 数据搬迁

当前方案中涉及数据搬迁的只有replace。即将数据从迁出盘搬到迁入盘。

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|编号|用例说明|
|---|---|
|1| 检查 rename 命令遵守以下 YFS 约束：,1. disk name 全局唯一
1. disk name 长度上限 31 char
1. 不允许空 disk name
|
|2|在线 drop disk 及 drop disks 时：,1. 仅允许 drop 无数据的 disk。
1. 如 disk 有数据，报错，并提示仅支持离线 drop 该磁盘。
1. 如试图 drop 不存在的 disk，报错。
|
|3|离线 drop disk 及 drop disks 时：,1. 如试图 drop 不存在的 disk，报错
1. exec drop disk 指令应立刻返回
1. 已有正在执行的 plan，报错。
|
|4|在线 replace：,1. 仅允许在线 replace 无数据的 disk。
1. 如 disk 有数据，报错，并提示仅支持离线 replace 该磁盘。
1. 如试图 replace 不存在的 disk，报错。
|
|5|离线 replace：,1. 如试图 replace 不存在的disk，报错。
1. exec replace 应立刻返回
1. 如已有执行的 plan，报错。
|


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138570717#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-7-4_11-39-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDNhMWFkOWEzMzExZGM5NGI1IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.TeyOmPpi7oRTQtc0yRC50S8WqxGOcDfTho44dTatKME)

 (image/png)    


[image2024-7-4_11-39-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDM4OTcwYzJhZjRmNTIxNjQzIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.Al9zu67ki1ze4UROd39tw53cC8cCLmpbzXpANg_lMPc)

 (image/png)    


[image2024-5-31_11-42-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDM4OTcwYzJhZjRmNTIxNjQ0IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.YJpl6cljJA_7XT8rL7WYe1umpLZezx-mZmRcHzfrKyg)

 (image/png)    


[image2024-5-31_11-42-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDM4OTcwYzJhZjRmNTIxNjQ1IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.R9hJqG7GKxWm-7AxKlE1tzcGWfx-tXEjl1FbR2b7pqs)

 (image/png)    


[image2024-5-31_11-42-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDNhMWFkOWEzMzExZGM5NGI2IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.XzKXKpaPEMVWmCmkYcYaxgiNPDgU-iRLQMhXIn3dbLM)

 (image/png)    


[image2024-5-31_10-19-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDNhMWFkOWEzMzExZGM5NGI3IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.WfUpv6Md8iMRG8VRZDuzgqxxTC0J7RtzR3bR0B975lU)

 (image/png)    


[image2024-5-31_9-23-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDNhMWFkOWEzMzExZGM5NGI4IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.0UhXPyzxQnbH9VHCE7rDYuya5_SIwsu0HmamLQ_IJ9E)

 (image/png)    


[image2024-5-31_9-23-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDM4OTcwYzJhZjRmNTIxNjQ2IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.KmF0Ebx-03TIS_h6fFYp18vuL94CA9c23YX2TjeLtwA)

 (image/png)    


[image2024-5-30_15-33-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDNhMWFkOWEzMzExZGM5NGI5IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.o6wauSni5fk-nWIJI7uAa1zs0ra3wrxnjMt7EVpntyI)

 (image/png)    


[image2024-7-8_18-0-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDM4OTcwYzJhZjRmNTIxNjQ3IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.sd2S9HoF6TlpXO8a-dUmsOEZzUi3FbXsGCOb6FB6Urc)

 (image/png)    


[image2024-7-8_10-23-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDM4OTcwYzJhZjRmNTIxNjQ4IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.VRc2fVBlGOkNyl7Balw3J6Gxd-h9T-KUCnMuaNtQTkg)

 (image/png)    


[image2024-7-8_14-7-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDQ4OTcwYzJhZjRmNTIxNjQ5IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.ruijV_USYY9bkeYPq9Fd05mb6U7QYqxP8B90O6wJQZs)

 (image/png)    


[image2024-7-8_14-36-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDRhMWFkOWEzMzExZGM5NGJhIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.tVKQpGm2po4mF699uPn9UTnLcagEu3VzMdZnxUZv5L0)

 (image/png)    


[image2024-7-8_11-33-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDRhMWFkOWEzMzExZGM5NGJiIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.vh7bCPzLW4DpXYBIQ7E7edX9t4kMxrzTGyhhZvRToik)

 (image/png)    


[image2024-7-8_11-30-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDRhMWFkOWEzMzExZGM5NGJjIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.jwiZORlGlC23p21jTVxwlNMc_cx9ERVa_VP8NyYFke4)

 (image/png)    


[image2024-7-8_11-23-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDQ4OTcwYzJhZjRmNTIxNjRhIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.tpyxqao-cJsghGcyl_wL1I34_w0VZXEqUnrdBTYYOJQ)

 (image/png)    


[image2024-7-8_11-20-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDQ4OTcwYzJhZjRmNTIxNjRiIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.qbtMOOIXNumxHLnkZCDpSDFdIJkc1shJ7m12OJOk0wM)

 (image/png)    


[image2024-7-8_11-18-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDQ4OTcwYzJhZjRmNTIxNjRjIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.YN7DLuj6S3kYapNyd5ODpfOfOCOa_5TTCjy4tOz8jqQ)

 (image/png)    


[image2024-7-8_10-39-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDRhMWFkOWEzMzExZGM5NGJkIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.mdKLhMrjZtkJFE_QXYyNzGFJwL30mOHtWYDXCIAE6AQ)

 (image/png)    


[image2024-7-4_18-5-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDRhMWFkOWEzMzExZGM5NGJlIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.AAis96xRI-RGHNJnx_MvqREFjjOg45tMY3wZaLunVxU)

 (image/png)    


[image2024-7-4_18-3-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDRhMWFkOWEzMzExZGM5NGJmIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.btvHqHC1G5uz6fml3WyW1GbPTZTH8P_fat4lDZJe5kU)

 (image/png)    


[image2024-7-4_16-31-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDRhMWFkOWEzMzExZGM5NGMwIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.qQ3MlZaw5NE-kXZn1037FgDwcz3MDIU85VWv-44g7t8)

 (image/png)    


[image2024-7-4_14-47-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDRhMWFkOWEzMzExZGM5NGMxIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.3qxpXy-isw-dceVHLb5SejyUb5BY9m66kBFaLChAEgA)

 (image/png)    


[image2024-7-4_14-39-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDQ4OTcwYzJhZjRmNTIxNjRlIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.yyLbVquV3lW76wDNOchIKwYMAL3y-aBWX9DnCgsh7PI)

 (image/png)    


[image2024-7-4_11-46-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDQ4OTcwYzJhZjRmNTIxNjRmIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.fSMpycxkuVheQrH4lqiEn1D1m2qRiwzdDIfJQY4durk)

 (image/png)    


[image2024-7-9_9-54-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDU4OTcwYzJhZjRmNTIxNjUwIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.0FdiZy55a3o90suCzUvzPpOiUtCtmtxaBeZswJR9K0g)

 (image/png)    


[image2024-7-9_10-10-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDVhMWFkOWEzMzExZGM5NGM1IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.v-dw6_63I1IZGIDA6_3n_mKL6Fm_Rd9bA_4hoK_FcSU)

 (image/png)    


[image2024-7-9_10-27-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDU4OTcwYzJhZjRmNTIxNjUxIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.JJBtvzBOeWmt7gN8oHXIVzIQCn8nATjI1ij2aJlLlL0)

 (image/png)    


[image2024-7-9_10-28-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDU4OTcwYzJhZjRmNTIxNjUyIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.hue00DZZTJEdehZRiOW8lHfKh4XGUUZBDMXkIG_uuKE)

 (image/png)    


[image2024-7-9_10-29-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDVhMWFkOWEzMzExZGM5NGM2IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.pjQp0Zfi3UtrFKCzu3unek-34cQSsFRKrJcPt1nQeyg)

 (image/png)    


[image2024-7-9_10-31-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDVhMWFkOWEzMzExZGM5NGM3IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.ZECvupDe8u9avt4xtgfQnWRPZrdcUNO157Sn7cqk9n4)

 (image/png)    


[image2024-7-9_10-38-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDU4OTcwYzJhZjRmNTIxNjUzIiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.kiLPohi975dD4Qe9l6HHN0Bof26UR2kPyRL_Lz8ZpEY)

 (image/png)    


[image2024-7-9_10-40-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDU4OTcwYzJhZjRmNTIxNjU0IiwicmVmX2lkIjoiNjczOTZlMDM1OTNmOTljOWZmMjM4MTY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjU1LCJleHAiOjE3ODI0MDAwNTV9.AY1lsaOi_VV7tTQMNFZn2l2BzE-w5S3jUi--MjwDYQM)

 (image/png)    


## Comments:

|  [](null)  ,一、ADD DISKS    
  1.add disks之前，首先生成diskgroup的change seq，diskgroup ctrl -->sync == false, 记录在diskgroup ctrl上    
  2.add的所有disk head上记录change seq    
  3.add结束之后将diskgroup的change seq改成invalid    
  4.broadcast    
  5.diskgroup ctrl-->sync == true,二、DROP DISKS    
  1.drop disks之前，首先生成一个diskgroup的change seq，把更新到disk head上    
  2.更新diskgroup ctrl上的change sep    
  3.drop disks    
  4.更行diskgroup ctrl上的change sep设置为invalid,重启之后如果发现diskgroup的change seq不是invalid，那么删除所有对应seq的disk，最后把seq置为invalid,create diskgroup的流程：    
  1.format disk    
  2.同步diskgroup的信息(发送所有的disk路径)，此时diskgroup的状态还是offline    
  3.主实例修改diskgroup为online    
  4.同步其他的实例（发送diskgroup id）,drop diskgroup的流程：    
  1.master修改diskgroup ctrl为offline    
  2.通过消息同步所有实例将diskgroup设置为offline状态    
  3.drop diskgroup    
  4.通过消息通知所有实例drop diskgroup,备升主的处理：    
  扫描所有的diskgroup：    
  1.如果diskgroup是offline，通过读取磁盘，确认diskgroup是否为online，如果是online，那么需要同步其他实例    
  2.如果diskgroup是online，扫描disks，通过读取磁盘确认是否已经为online，如果是online，需要同步其他实例,  
  两个问题：    
  1.保证原子性    
  2.master故障场景下的实例同步,  
,Posted by mayong at 九月 09, 2024 20:36|
|---|

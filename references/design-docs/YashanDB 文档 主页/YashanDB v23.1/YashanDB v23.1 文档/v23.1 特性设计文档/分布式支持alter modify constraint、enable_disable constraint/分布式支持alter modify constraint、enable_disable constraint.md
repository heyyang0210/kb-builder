Created by 周宇航, last modified on 八月 22, 2023

jira：    [[YDBRD-16150]分布式支持alter modify constraint、enable/disable constraint](https://jira.yasdb.com/browse/YDBRD-16150)  

##   [1. Overview（概述）](#1-overview概述)  

-   [LSC已支持唯一约束](https://conf.yasdb.com/pages/viewpage.action?pageId=107384763)    ，此处分布式进一步支持其他相关语法。
- 兼容oracle的语法，目前单机版中已支持该类功能，分布式也需适当跟进。


##   [2. Features（功能特性）](#2-features功能特性)  

|支持特性|
|---|
|分布式场景支持modify constraint语法（    `alter table modify`    ）|
|分布式场景支持enable/disable constraint语法 （    `alter table disable`    ）|


##   [3. Interfaces（接口）](#3-interfaces接口)  

modify_constraint

![](https://pingcode.yasdb.com/atlas/files/public/67396b2aa1ad9a3311dc80b4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUNBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE0ODUsImV4cCI6MTc4MjMwMjI4NX0.cfkLR2Jg_HWpsuXdpmTRT0OVP5KfeCw66yffC8EKtFM)

enable_disable_constraint

![](https://pingcode.yasdb.com/atlas/files/public/67396b2a8970c2af4f52023e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUNBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE0ODUsImV4cCI6MTc4MjMwMjI4NX0.cfkLR2Jg_HWpsuXdpmTRT0OVP5KfeCw66yffC8EKtFM)

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 分布式表存储结构为LSC：
    - 不支持外键和check和using，相关modify、enable/disable不能使用，如    `alter table modify constraint check enable`    。
- 分布式表存储结构为TAC：
    - 不支持外键，相关modify、enable/disable不能使用，如    `alter table modify constraint foreign_key enable`    。
    - 若主键或unique约束已经被enable，再次enable时若使用using index的目标索引为对应约束的索引则返回success其余都会返回错误。
- 分布式结构限制，primary和unique约束仅能创建在包含分布键的列集合中，unique不能重复创建在已经变为primary的列集合。
- 即使disable了对应的约束也不可以创建同名约束、创建多个primary和对同列创建多个unique约束。
- 相关novalidate/validate表现
    -   `unique/priamry/not null`    约束中。
    -         1.   `enable validate`    将检查表中数据是否符合约束再创建约束。
        1.   `enable novalidate`    ，由于结构设计，创建约束实际会强制要求符合，比如unique天然要求所有值唯一。
        1.   `disable validate`    将会阻止insert/update/delete的操作。
        1.   `disable novalidate`    为禁用该约束之后没有该约束限制。

    -   `check`    约束中，第2点    `enable novalidate`    有区别，他将不会检查之前的数据是否符合约束，仅会检查后续insert/update/delete的数据是否符合约束


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

并未涉及代码修改，仅为开放此处功能，并考虑测试样例情况查看该功能是否完善。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. primary和unique的重复情况。


```
alter table lsc_cons_test disable primary key;
alter table lsc_cons_test disable unique(a,b);
alter table lsc_cons_test disable unique(a);

```

1. null、unique约束的相关功能情况。


```
alter table test_not_null add primary key (a);
insert into test_not_null values (null);

```

1. TAC存储中的check约束和using index的使用情况。


```
alter table ccons_check add constraint ccons_ck check (a &lt; 5);
alter table ccons_check add constraint ccons_ck check (a &lt; 5) disable;

alter table test_using_index add constraint using_index_pk primary key(a) using index(create index using_index_1 on test_using_index(a));
alter table test_using_index enable constraint using_index_pk using index (create index using_index_2 on test_using_index(a));

```

##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

- ~~validate/novalidate始终默认为validate，等于是validate/novalidate字段没有实际作用。~~  （2023.8.10，改字段对应已跟进，具体看    [功能限制](#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)    ）


## Attachments:

[image2023-8-7_11-15-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMjlhMWFkOWEzMzExZGM4MGIxIiwicmVmX2lkIjoiNjczOTZiMjk3MjgyMDZlZmI5MmYwMjZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDg0LCJleHAiOjE3ODIzNzc4ODR9.nly7WzPUD7xcb9PexNAZ-6moRfnHaGHti_8ApgmSynI)

 (image/png)    


[image2023-8-7_11-24-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMjk4OTcwYzJhZjRmNTIwMjNjIiwicmVmX2lkIjoiNjczOTZiMjk3MjgyMDZlZmI5MmYwMjZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxNDg0LCJleHAiOjE3ODIzNzc4ODR9.LFmn9rjOU4MKvcR7kNs6RoJiOFDcda5BcSp4OiFCVDY)

 (image/png)    

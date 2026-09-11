Created by 同二鹏, last modified on 六月 17, 2024

IR链接：     [YASHAN-986 - 集群支持扩容实例节点](https://pingcode.yasdb.com/ship/ideas/660b7443009f91eb87f2b32a)  

SR链接：      [YDBRD-34341 - 集群支持扩容实例节点](https://pingcode.yasdb.com/pjm/items/670f8126e489dd0868f89da3)  

DB支持集群扩容详细设计文档：   [详细设计-YDBRD-34341 : Cluster Instance Expansion Design（集群支持实例扩展方案设计）](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/673da522593f99c9ff27d414)  



## 1. 总述



数据库运维过程中，业务压力是变化的。为满足数据库服务能力的弹性扩展，需要提供动态增加集群实例的能力。



### 1.1 需求来源



集群基础能力



### 1.2 调研文档



达梦动态增加节点文档：      [[动态增加节点 | 达梦技术文档 (dameng.com)]](https://eco.dameng.com/document/dm/zh-cn/pm/dynamically-expand-nodes.html)  



ORACLE增加节点文档：      [[Adding and Deleting Oracle RAC from Nodes on Linux and UNIX Systems]](https://docs.oracle.com/en/database/oracle/oracle-database/19/racad/adding-and-deleting-oracle-rac-from-nodes-on-linux-and-unix-systems.html#GUID-924C2E52-4C34-4500-92FB-80A453FE14A9)  



## 2. 接口



![image.png](https://pingcode.yasdb.com/atlas/files/public/677358f7a1ad9a3311de5c40/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFJQUFBQUFBQUFBQUFBQUFBQVFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTcwODcsImV4cCI6MTc4MjQ2Nzg4N30.Hroy-S8xL2KHltUvfuw4d3s8driAicsNRzPVGlsUPI0)



## 3. 规格与约束



- 每次只支持添加一个实例，不支持批量添加实例

- 至少有一个db实例处于open状态

- 节点数不能超过建库指定的max instances

- 只能在主DB实例执行添加实例的业务





## 4. 特性

### 总体架构



![image.png](https://pingcode.yasdb.com/atlas/files/public/67735924a1ad9a3311de5c41/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFJQUFBQUFBQUFBQUFBQUFBQVFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTcwODcsImV4cCI6MTc4MjQ2Nzg4N30.Hroy-S8xL2KHltUvfuw4d3s8driAicsNRzPVGlsUPI0)



#### redo添加



当前版本只支持本实例添加redo文件，需要支持为扩展实例添加redo文件。



- 目前已经支持其他实例日志文件的内存管理
- 分配redo ctrl过滤指定实例的redo ctrl block






#### undo添加



- 创建undo表空间
- 初始化undo表空间
- 初始化事务区






#### 实例节点数更新



DB实例内存维护了节点数信息，实例启动时通过加载bootctrl获取。该节点数信息表示数据库支持的实例个数。如两实例数据库，存在两份私有redo文件，undo文件。



集群实例扩展后，数据库文件支持的实例个数发生变化，需要同步更新所有DB实例内存中的节点数信息。



#### 本地临时表空间



- 已经存在的临时表空间




- 能否废弃？在线业务可能正在使用本地临时表空间，存在不确定性，如做并发控制影响太大，故不能废弃




- 扩展实例需补全本地临时表空间文件。主实例执行实例扩展业务，扩展实例未启动，主实例没法完成此任务。只能由扩展实例启动过程补全本地临时表空间文件。
    - 实例启动过程中，根据space ctrl和datafile ctrl感知是否需要补全临时表空间文件，如果需要补全，做两件事，一是申请data file ctrl，二是创建本地临时表空间文件。
    - 补全失败怎么处理？  1. 本实例标记表空间不可用，后台尝试补全，直到成功后本实例可用该表空间   2. 启动失败，报错




- 正在进行的临时表空间业务    
    - 创建本地临时表空间要求所有实例在线，如果正在进行的业务感知到扩展实例，该业务报错。否则，业务继续正常进行，扩展实例启动过程补全文件。






#### 实例启动



实例启动后，通过读取bootctrl获取节点数信息，需要保证实例启动后一定能获得最新的节点数信息。因此节点数更新时，需要先更新ctrl文件，再广播给其他实例。



#### 实例关闭



不涉及



#### 实例故障



- 非主实例故障，出现add instance和在线恢复并发的场景。如果实例个数已经变化，在线恢复时会将添加实例事务区同步托管。如果实例个数还未变化，不影响在线恢复。
- 主实例故障，添加实例中途失败






#### 异常场景



- 添加实例过程中遇到错误，在add instance流程内清理不完整的实例文件
- 添加实例过程中遇到进程故障，需要在主实例启动过程中清理不完整的实例文件。






  





## 5.未来规划


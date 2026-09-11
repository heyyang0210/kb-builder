IR链接：  [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2dc?](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2dc?)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求合理性分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#11-%E9%9C%80%E6%B1%82%E5%90%88%E7%90%86%E6%80%A7%E5%88%86%E6%9E%90)  

当数据库产生逻辑损坏（如误操作）或者物理损坏（如磁盘坏块时），通常需要通过备份恢复来将数据库恢复到某个时间点。但是传统的备份恢复技术的恢复时间与库大小成正比，这就导致在库比较大时可能因为一个很小的错误需要花费很长时间来完成整库的恢复。而全库闪回技术提供了一种高效的数据恢复机制，恢复时间不再受数据库本身大小的影响，可以在较短的时间内将一个很大的数据库恢复至某个时间点。



###   [1.2 oracle调研](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#12-%E9%9C%80%E6%B1%82%E5%AE%9E%E7%8E%B0%E5%88%86%E6%9E%90)  

#### 闪回相关语法：

flashback database：全库闪回执行语句，可指定闪回的目标时间（scn、time、restore point）

![WXWorkLocalPro_17405555831108.png](https://pingcode.yasdb.com/atlas/files/public/67bec5906a1ae92ae3736676/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFJQVFnQUFCQU1BRWdBQkFBQUFBQWlBQUFBQUFBZ0FBQUFRQUFBRUlBSUFBRUFBQUFBQUFBRUFKQUFCQVlBQUFBUURBQUlBQUJBRUFBQUFRQUFBQUFnQUJBQUlBZ0JnQUFBQWdBZ0FJQUVBQVFBQUVBUUFCQUFBQUFBQUFBQUFBRUFBSUFBZ0FBQUFBQUFBQXdBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYzNDUsImV4cCI6MTc4MjQ2NzE0NX0.wQzbmf9ub7xvPjeSxml6K1VNUDfqwMtcHzgOMiMROIs)

create restore point：创建还原点

![WXWorkLocalPro_1740555693192.png](https://pingcode.yasdb.com/atlas/files/public/67bec5b56a1ae92ae3736679/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFJQVFnQUFCQU1BRWdBQkFBQUFBQWlBQUFBQUFBZ0FBQUFRQUFBRUlBSUFBRUFBQUFBQUFBRUFKQUFCQVlBQUFBUURBQUlBQUJBRUFBQUFRQUFBQUFnQUJBQUlBZ0JnQUFBQWdBZ0FJQUVBQVFBQUVBUUFCQUFBQUFBQUFBQUFBRUFBSUFBZ0FBQUFBQUFBQXdBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYzNDUsImV4cCI6MTc4MjQ2NzE0NX0.wQzbmf9ub7xvPjeSxml6K1VNUDfqwMtcHzgOMiMROIs)

drop restore point：删除还原点

![WXWorkLocalPro_17405557188008.png](https://pingcode.yasdb.com/atlas/files/public/67bec5ce6a1ae92ae373667a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFJQVFnQUFCQU1BRWdBQkFBQUFBQWlBQUFBQUFBZ0FBQUFRQUFBRUlBSUFBRUFBQUFBQUFBRUFKQUFCQVlBQUFBUURBQUlBQUJBRUFBQUFRQUFBQUFnQUJBQUlBZ0JnQUFBQWdBZ0FJQUVBQVFBQUVBUUFCQUFBQUFBQUFBQUFBRUFBSUFBZ0FBQUFBQUFBQXdBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYzNDUsImV4cCI6MTc4MjQ2NzE0NX0.wQzbmf9ub7xvPjeSxml6K1VNUDfqwMtcHzgOMiMROIs)

alter database flashback on/off：库级闪回开关



#### 闪回相关视图：

v$flashback_database_log：记录闪回整体信息

![WXWorkLocalPro_17405558405458.png](https://pingcode.yasdb.com/atlas/files/public/67bec6476a1ae92ae373667b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFJQVFnQUFCQU1BRWdBQkFBQUFBQWlBQUFBQUFBZ0FBQUFRQUFBRUlBSUFBRUFBQUFBQUFBRUFKQUFCQVlBQUFBUURBQUlBQUJBRUFBQUFRQUFBQUFnQUJBQUlBZ0JnQUFBQWdBZ0FJQUVBQVFBQUVBUUFCQUFBQUFBQUFBQUFBRUFBSUFBZ0FBQUFBQUFBQXdBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYzNDUsImV4cCI6MTc4MjQ2NzE0NX0.wQzbmf9ub7xvPjeSxml6K1VNUDfqwMtcHzgOMiMROIs)



v$flashback_database_logfile：记录所有闪回日志文件信息

![WXWorkLocalPro_17405558642288.png](https://pingcode.yasdb.com/atlas/files/public/67bec6606a1ae92ae373667c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFJQVFnQUFCQU1BRWdBQkFBQUFBQWlBQUFBQUFBZ0FBQUFRQUFBRUlBSUFBRUFBQUFBQUFBRUFKQUFCQVlBQUFBUURBQUlBQUJBRUFBQUFRQUFBQUFnQUJBQUlBZ0JnQUFBQWdBZ0FJQUVBQVFBQUVBUUFCQUFBQUFBQUFBQUFBRUFBSUFBZ0FBQUFBQUFBQXdBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYzNDUsImV4cCI6MTc4MjQ2NzE0NX0.wQzbmf9ub7xvPjeSxml6K1VNUDfqwMtcHzgOMiMROIs)



v$restore_point：记录所有还原点信息

![WXWorkLocalPro_17405559867754.png](https://pingcode.yasdb.com/atlas/files/public/67bec6dd6a1ae92ae373667d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFJQVFnQUFCQU1BRWdBQkFBQUFBQWlBQUFBQUFBZ0FBQUFRQUFBRUlBSUFBRUFBQUFBQUFBRUFKQUFCQVlBQUFBUURBQUlBQUJBRUFBQUFRQUFBQUFnQUJBQUlBZ0JnQUFBQWdBZ0FJQUVBQVFBQUVBUUFCQUFBQUFBQUFBQUFBRUFBSUFBZ0FBQUFBQUFBQXdBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYzNDUsImV4cCI6MTc4MjQ2NzE0NX0.wQzbmf9ub7xvPjeSxml6K1VNUDfqwMtcHzgOMiMROIs)



v$database中的FLASHBACK_ON字段代表闪回开关状态



#### 闪回相关配置参数：

|NAME|TYPE|DEFAULT VALUE|DETAIL|
|---|---|---|---|
|db_flashback_retention_target|integer|1440|闪回日志文件默认保留时间，单位为分钟，默认保留一天|
|db_recovery_file_dest_size|big integer|50G|闪回日志文件目录的szie|




#### 闪回权限、审计：

1. flashback database、创建删除永久还原点需要sysdba权限
1. 闪回开关跟随alter database语法权限
1. 创建删除普通还原点需要SELECT ANY DICTIONARY, FLASHBACK ANY TABLE, SYSDBA, SYSBACKUP, or SYSDG系统权限
1. 创建删除还原点语法可创建审计、其他语法则没有


![WXWorkLocalPro_17405562874946.png](https://pingcode.yasdb.com/atlas/files/public/67bec80e6a1ae92ae373667f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFJQVFnQUFCQU1BRWdBQkFBQUFBQWlBQUFBQUFBZ0FBQUFRQUFBRUlBSUFBRUFBQUFBQUFBRUFKQUFCQVlBQUFBUURBQUlBQUJBRUFBQUFRQUFBQUFnQUJBQUlBZ0JnQUFBQWdBZ0FJQUVBQVFBQUVBUUFCQUFBQUFBQUFBQUFBRUFBSUFBZ0FBQUFBQUFBQXdBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYzNDUsImV4cCI6MTc4MjQ2NzE0NX0.wQzbmf9ub7xvPjeSxml6K1VNUDfqwMtcHzgOMiMROIs)

![WXWorkLocalPro_1740556247384.png](https://pingcode.yasdb.com/atlas/files/public/67bec7e76a1ae92ae373667e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFJQVFnQUFCQU1BRWdBQkFBQUFBQWlBQUFBQUFBZ0FBQUFRQUFBRUlBSUFBRUFBQUFBQUFBRUFKQUFCQVlBQUFBUURBQUlBQUJBRUFBQUFRQUFBQUFnQUJBQUlBZ0JnQUFBQWdBZ0FJQUVBQVFBQUVBUUFCQUFBQUFBQUFBQUFBRUFBSUFBZ0FBQUFBQUFBQXdBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYzNDUsImV4cCI6MTc4MjQ2NzE0NX0.wQzbmf9ub7xvPjeSxml6K1VNUDfqwMtcHzgOMiMROIs)

![WXWorkLocalPro_17405563278910.png](https://pingcode.yasdb.com/atlas/files/public/67bec8326a1ae92ae3736680/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFJQVFnQUFCQU1BRWdBQkFBQUFBQWlBQUFBQUFBZ0FBQUFRQUFBRUlBSUFBRUFBQUFBQUFBRUFKQUFCQVlBQUFBUURBQUlBQUJBRUFBQUFRQUFBQUFnQUJBQUlBZ0JnQUFBQWdBZ0FJQUVBQVFBQUVBUUFCQUFBQUFBQUFBQUFBRUFBSUFBZ0FBQUFBQUFBQXdBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYzNDUsImV4cCI6MTc4MjQ2NzE0NX0.wQzbmf9ub7xvPjeSxml6K1VNUDfqwMtcHzgOMiMROIs)



#### 闪回约束：

1. 开启闪回前要保证开启归档
1. 配置快速恢复区
1. 如果ctrl文件被restore或rebuild过（如restore database）后，原来的闪回信息将会过期
1. 闪回不能包含offline tablespace


![WXWorkLocalPro_17405564142210.png](https://pingcode.yasdb.com/atlas/files/public/67bec88639823f2ac1f260d3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFJQVFnQUFCQU1BRWdBQkFBQUFBQWlBQUFBQUFBZ0FBQUFRQUFBRUlBSUFBRUFBQUFBQUFBRUFKQUFCQVlBQUFBUURBQUlBQUJBRUFBQUFRQUFBQUFnQUJBQUlBZ0JnQUFBQWdBZ0FJQUVBQVFBQUVBUUFCQUFBQUFBQUFBQUFBRUFBSUFBZ0FBQUFBQUFBQXdBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYzNDUsImV4cCI6MTc4MjQ2NzE0NX0.wQzbmf9ub7xvPjeSxml6K1VNUDfqwMtcHzgOMiMROIs)



#### 闪回流程：

1. 开启归档并配置好快速恢复区
1. 在mount/open下打开闪回开关
1. 根据需要记录想要闪回的时间点（scn、time），或者创建还原点
1. 重启数据库到mount阶段执行flashback database还原到想要的时间点
1. 闪回完成后可以选择open readOnly查看数据库状态是否满足预期，满足则重启并open resetlogs，不满足则重启直接open走重启恢复回到闪回前




#### 闪回关于数据文件ddl的处理方法：

![WXWorkLocalPro_17405565679759.png](https://pingcode.yasdb.com/atlas/files/public/67bec92239823f2ac1f260d6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFJQUFBQUFJQVFnQUFCQU1BRWdBQkFBQUFBQWlBQUFBQUFBZ0FBQUFRQUFBRUlBSUFBRUFBQUFBQUFBRUFKQUFCQVlBQUFBUURBQUlBQUJBRUFBQUFRQUFBQUFnQUJBQUlBZ0JnQUFBQWdBZ0FJQUVBQVFBQUVBUUFCQUFBQUFBQUFBQUFBRUFBSUFBZ0FBQUFBQUFBQXdBQVVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYzNDUsImV4cCI6MTc4MjQ2NzE0NX0.wQzbmf9ub7xvPjeSxml6K1VNUDfqwMtcHzgOMiMROIs)



#### 闪回特殊表现：

1. 闪回开关可在open/mount下进行
1. 开启或关闭闪回不影响还原点，闪回完成后以前的还原点仍然可用
1. 可以在mount下多次连续闪回或直接直接open走重启恢复
1. 可以闪回到不同时间线的还原点
1. 开启闪回后可以删除归档，闪回会另外备份归档
1. 开启闪回后对性能影响5%




#### 主备闪回：

1. 主备独立打开flashback db
1. 主机打开闪回，备机不打开闪回，主机闪回成功后open resetlogs，结果并不同步到备机，备机仍旧维持原样，后续主机继续做业务，也不同步到备机了
1. 主机不打开闪回，备机打开闪回
    1. 备机闪回后，无法open resetlogs，也就代表着无法rollback。此时只能升主才能open resetlogs
    1. 备机闪回后，与主机脱离关系，独立存在   ---  确认是否真的脱离，理论上主备重新建立链接备机会自动接受日志追上主机
1. 备机如果要做flashback相关的操作，需要先关闭和主机的apply rd链路，才能执行
1. oracle 19c支持在主备都打开flashback的情况下，主机创建还原点，备机也同步这个还原点，还原点名字不一样，备机会带后缀。当主机闪回完成并open resetlogs后，备机重启到mount，并重启与主机之间的apply链路后，open read only自动应用闪回




###   [1.3 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#13-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|flashback database|全库闪回。在没有数据库备份的情况下通过闪回日志完成数据库的秒级闪回，回退到指定时间点|是||




###   [1.4 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#14-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不依赖。



##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#2-%E6%8E%A5%E5%8F%A3)  

友商特性对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|flashback database|闪回数据库|是|
|SQL语法|create restore point|创建还原点|是|
|SQL语法|drop restore point|删除还原点|是|
|SQL语法|alter database flashback|库级闪回开关|是|
|动态视图|v$flashback_database_log|闪回整体数据信息|是|
|动态视图|v$flashback_database_logfile|闪回日志文件信息|是|
|动态视图|v$restore_point|还原点信息|是|
|配置参数|db_flashback_retention_target|闪回日志文件默认保留时间，单位为分钟，默认保留一天|是|
|配置参数|db_recovery_file_dest_size|闪回日志文件目录的szie|是|




##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

无



##   [4. Dependency（功能依赖）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#4-dependency%E5%8A%9F%E8%83%BD%E4%BE%9D%E8%B5%96)  

PITR


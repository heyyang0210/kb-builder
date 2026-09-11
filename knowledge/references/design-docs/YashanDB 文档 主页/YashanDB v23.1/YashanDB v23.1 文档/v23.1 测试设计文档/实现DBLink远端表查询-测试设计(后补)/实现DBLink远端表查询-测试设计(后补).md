Created by 孟麟 on 十月 31, 2023

# **1. 概述**

  [YDBRD-13328](https://jira.yasdb.com/browse/YDBRD-13328?src=confmacro)    -  实现DBLINK的远端表查询语句  完成

# **2. 需求分析**

1、查询语法分析，见xmind

2、其他规格等分析见excel（测试用例）

# **3. 测试**  **设计方法**

1、参考select顶层设计，覆盖全部语法点

2、针对dblink，重点关注两端数据库的结合差异点和新增内容，包括：数据类型和精度差异，函数下推；yex_server新增进程管理和配置参数

# 4.   **详细测试设计**

# 5.   **测试用例**

# **6 测试框架设计**

功能和专项框架暂时不支持，需要提需求解决

  


## Attachments:

[实现DBLINK的远端表查询语句-刷新.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmRhMWFkOWEzMzExZGM3OWUyIiwicmVmX2lkIjoiNjczOTY5ZmQ3MjgyMDZlZmI5MmVmOTg4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNjMxLCJleHAiOjE3ODIyOTcwMzF9.MDuYlMFveGNTDqge_OaAMLkNKgWW076k6IatzOahCV8)

 (application/x-xmind)    


[DBLink查询测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmQ4OTcwYzJhZjRmNTFmYjZiIiwicmVmX2lkIjoiNjczOTY5ZmQ3MjgyMDZlZmI5MmVmOTg4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNjMxLCJleHAiOjE3ODIyOTcwMzF9.XACprnSiz965-ZDW0IeWVXgmGqkxcPjCZOhIwhjRnFE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[DBLink查询测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmRhMWFkOWEzMzExZGM3OWUzIiwicmVmX2lkIjoiNjczOTY5ZmQ3MjgyMDZlZmI5MmVmOTg4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNjMxLCJleHAiOjE3ODIyOTcwMzF9.GCp0AcxwLnUuFs2lzYoasdwEpqPzVFsgqH8GFACiWeQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    

Created by 李世铭, last modified on 十月 31, 2023

# 1.     **概述**

提供流式备份接口，对接鼎甲等第三方备份软件

# 2.     **需求分析**

  [YDBRD-16398](https://jira.yasdb.com/browse/YDBRD-16398?src=confmacro)    **-**  **【OM】支持yasrman客户端部署和备份封装**  **完成**

**设计文档：**    [流式备份API](112729495.html)  

### **2.1 功能分析**

yasbak是一个针对yasrman的管理工具，对yasrman进行了简单封装，方便客户快速上手。

|命令参数|备注|
|:---|:---|
|yasbak deploy|初始化yasbak和yasrman所需的运行环境|
|yasbak clean|清理yasbak和yasrman初始化时生成的目录和配置|
|yasbak run|获取数据库信息，并调用yasrman执行备份、备份清理或恢复操作|


# 3.   **测试设计方法**

主要采用场景法，边界值法等进行测试设计   

# 4.   **详细测试设计**

## Attachments:

[支持yasrman客户端部署和备份封装.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWVhMWFkOWEzMzExZGM3N2Y5IiwicmVmX2lkIjoiNjczOTY5OWU3MjgyMDZlZmI5MmVmNTNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzQ5LCJleHAiOjE3ODIyOTQxNDl9.5F2xCEvOEY59BDLLG5csLvNY944iLQJp1hfFMy3lWnk)

 (application/x-xmind)    

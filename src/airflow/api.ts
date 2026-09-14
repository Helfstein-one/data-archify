export interface AirflowTask {
  task_id: string;
  class_ref?: {
    module_path: string;
    class_name: string;
  };
  downstream_task_ids: string[];
}

export async function fetchAirflowTasks(url: string, dagId: string, username?: string, password?: string): Promise<AirflowTask[]> {
  const endpoint = `${url.replace(/\/$/, '')}/api/v1/dags/${dagId}/tasks`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };

  if (username && password) {
    const b64 = Buffer.from(`${username}:${password}`).toString('base64');
    headers['Authorization'] = `Basic ${b64}`;
  }

  const response = await fetch(endpoint, { headers });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Airflow API error: ${response.status} ${response.statusText} - ${errText}`);
  }

  const data = await response.json();
  return data.tasks || [];
}
